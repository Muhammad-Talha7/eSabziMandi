from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user_role
from models.auction import Auction
from models.bid import Bid
from models.product import Product
from schemas.auction import AuctionCreate, AuctionOut, AuctionDetail, BidCreate, BidOut

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_auction_or_404(auction_id: int, db: Session) -> Auction:
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found",
        )
    return auction


def _utc_now_naive() -> datetime:
    """Return current UTC time as a timezone-naive datetime (matches MySQL DATETIME)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _validate_live_auction(auction: Auction) -> None:
    """Raise 400 if auction is not live or outside its time window."""
    if auction.status != "live":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Auction is not live (current status: {auction.status})",
        )
    now = _utc_now_naive()
    if not (auction.start_time <= now <= auction.end_time):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auction is outside its active time window",
        )


def _validate_bid_amount(amount: Decimal, current_price) -> None:
    """Raise 400 if bid is not strictly greater than current price."""
    if amount <= Decimal(str(current_price)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bid must be greater than current price ({current_price})",
        )


# ── POST /auctions ── farmer only, must own the product ─────────────────────

@router.post("/", response_model=AuctionOut, status_code=status.HTTP_201_CREATED)
def create_auction(
    payload: AuctionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["farmer"])),
):
    """Create an auction. Farmer must own the product."""
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if product.farmer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this product")
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_time must be after start_time")

    auction = Auction(
        product_id=payload.product_id,
        starting_price=payload.starting_price,
        current_price=payload.starting_price,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status="upcoming",
    )
    db.add(auction)
    db.commit()
    db.refresh(auction)
    return auction


# ── GET /auctions ── public list, filter by status ───────────────────────────

@router.get("/", response_model=list[AuctionOut])
def list_auctions(
    db: Session = Depends(get_db),
    auction_status: str = Query("live", description="Filter by auction status (comma separated)"),
):
    """Public listing of auctions, filtered by status (default: live)."""
    statuses = [s.strip() for s in auction_status.split(",")]
    return (
        db.query(Auction)
        .filter(Auction.status.in_(statuses))
        .order_by(Auction.end_time.asc())
        .all()
    )


# ── GET /auctions/{id} ── public detail with highest bid info ────────────────

@router.get("/{auction_id}", response_model=AuctionDetail)
def get_auction(auction_id: int, db: Session = Depends(get_db)):
    """Single auction detail including highest bid information."""
    auction = _get_auction_or_404(auction_id, db)

    highest_bid = (
        db.query(Bid)
        .filter(Bid.auction_id == auction_id)
        .order_by(Bid.amount.desc())
        .first()
    )

    out = AuctionDetail.model_validate(auction)
    if highest_bid:
        out.highest_bid = highest_bid.amount
        out.highest_bidder_id = highest_bid.buyer_id
    return out


# ── GET /auctions/{id}/bids ── public, all bids ordered by amount desc ──────

@router.get("/{auction_id}/bids", response_model=list[BidOut])
def list_bids(auction_id: int, db: Session = Depends(get_db)):
    """All bids for an auction, highest first."""
    _get_auction_or_404(auction_id, db)
    return (
        db.query(Bid)
        .filter(Bid.auction_id == auction_id)
        .order_by(Bid.amount.desc())
        .all()
    )


# ── POST /auctions/{id}/bid ── REST fallback, buyer only ────────────────────

@router.post("/{auction_id}/bid", response_model=BidOut, status_code=status.HTTP_201_CREATED)
def place_bid(
    auction_id: int,
    payload: BidCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["buyer"])),
):
    """Place a bid via REST. Auction must be live, bid > current_price."""
    auction = _get_auction_or_404(auction_id, db)
    _validate_live_auction(auction)
    _validate_bid_amount(Decimal(str(payload.amount)), auction.current_price)

    bid = Bid(auction_id=auction_id, buyer_id=current_user.id, amount=payload.amount)
    db.add(bid)
    auction.current_price = payload.amount
    db.commit()
    db.refresh(bid)
    return bid
