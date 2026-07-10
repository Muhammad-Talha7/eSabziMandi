from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user, get_current_user_role
from models.order import Order
from models.product import Product
from models.user import User
from models.auction import Auction
from models.payment import Payment
from models.delivery import Delivery
from schemas.order import OrderCreate, OrderOut, FarmerOrderOut
from sqlalchemy.orm import aliased
from sqlalchemy import or_
from fastapi import Query
from typing import Optional

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_order_or_404(order_id: int, db: Session) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return order


def _assert_order_owner(order: Order, current_user) -> None:
    """Raise 403 if the current user is not the buyer of the order."""
    if order.buyer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this order",
        )


# ── POST /orders/direct ── buyer only, direct product purchase ───────────────

@router.post(
    "/direct",
    response_model=OrderOut,
    status_code=status.HTTP_201_CREATED,
)
def create_direct_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["buyer"])),
):
    """
    Purchase a product directly (bypasses auctions).

    - Product must be **active**.
    - Requested quantity must not exceed available stock.
    - ``total_amount`` is computed as ``product.price × quantity``.
    - Product quantity is decremented atomically in the same transaction.
    - If stock reaches zero the product status is set to "sold".
    - Sets ``product_id``; ``auction_id`` is null — the payments module
      treats these orders identically to auction-won orders.
    """
    product = (
        db.query(Product)
        .filter(Product.id == payload.product_id)
        .with_for_update()   # SELECT … FOR UPDATE — holds row lock until commit
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    if product.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product is not available for purchase (status: {product.status})",
        )

    requested = Decimal(str(payload.quantity))
    available = Decimal(str(product.quantity))

    if requested > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient stock: requested {requested}, "
                f"available {available} {product.unit}"
            ),
        )

    total_amount = Decimal(str(product.price)) * requested

    # Decrement stock; mark sold if fully depleted.
    product.quantity = available - requested
    if product.quantity == 0:
        product.status = "sold"

    order = Order(
        buyer_id=current_user.id,
        product_id=product.id,
        auction_id=None,
        total_amount=total_amount,
        status="pending",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


# ── GET /orders/me ── must come BEFORE /{id} to avoid int-cast clash ─────────

@router.get("/me", response_model=list[OrderOut])
def list_my_orders(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["buyer"])),
):
    """
    All orders belonging to the authenticated buyer — both auction-won and
    direct purchases — newest first.
    """
    return (
        db.query(Order)
        .filter(Order.buyer_id == current_user.id)
        .order_by(Order.created_at.desc())
        .all()
    )


# ── GET /orders/{id} ── buyer who owns it, or admin ──────────────────────────

@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Retrieve a single order by ID.

    - Buyer who owns the order, **or** admin.
    """
    order = _get_order_or_404(order_id, db)

    if current_user.role != "admin":
        _assert_order_owner(order, current_user)

    return order

# ── GET /orders/farmer/me ── farmer only ─────────────────────────────────────

@router.get("/farmer/me", response_model=list[FarmerOrderOut])
def list_farmer_orders(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["farmer"])),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by order status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Returns all orders where the order's product (direct purchase) or 
    auction's product (auction win) belongs to the current farmer.
    Includes buyer details, payment status, and delivery status.
    """
    DirectProduct = aliased(Product)
    AuctionProduct = aliased(Product)

    query = (
        db.query(Order, User)
        .join(User, Order.buyer_id == User.id)
        .outerjoin(DirectProduct, Order.product_id == DirectProduct.id)
        .outerjoin(Auction, Order.auction_id == Auction.id)
        .outerjoin(AuctionProduct, Auction.product_id == AuctionProduct.id)
        .filter(
            or_(
                DirectProduct.farmer_id == current_user.id,
                AuctionProduct.farmer_id == current_user.id
            )
        )
    )

    if status_filter:
        query = query.filter(Order.status == status_filter)

    query = query.order_by(Order.created_at.desc())
    items = query.offset((page - 1) * limit).limit(limit).all()

    results = []
    for order, user in items:
        # Get most recent payment status
        payment = db.query(Payment).filter(Payment.order_id == order.id).order_by(Payment.created_at.desc()).first()
        # Get delivery status
        delivery = db.query(Delivery).filter(Delivery.order_id == order.id).first()

        out = FarmerOrderOut(
            id=order.id,
            buyer_id=order.buyer_id,
            auction_id=order.auction_id,
            product_id=order.product_id,
            total_amount=order.total_amount,
            status=order.status,
            created_at=order.created_at,
            buyer_name=user.name,
            buyer_email=user.email,
            buyer_phone=user.phone,
            payment_status=payment.status if payment else None,
            delivery_status=delivery.status if delivery else None
        )
        results.append(out)

    return results
