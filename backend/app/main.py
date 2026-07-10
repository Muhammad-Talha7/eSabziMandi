import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from api.routes.auth import router as auth_router
from api.routes.products import router as products_router
from api.routes.auctions import router as auctions_router
from api.routes.orders import router as orders_router
from api.routes.payments import router as payments_router
from api.routes.deliveries import router as deliveries_router
from api.routes.admin import router as admin_router
from api.routes.ws_auctions import auction_ws_endpoint

logger = logging.getLogger("uvicorn.error")


# ── Auction Manager Background Task ────────────────────────────────────────────

async def _auction_manager() -> None:
    """
    Runs every 30 seconds. 
    1. Finds 'upcoming' auctions where start_time <= now, sets to 'live'.
    2. Finds 'live' auctions where end_time <= now, sets to 'closed',
       and creates a pending Order for the highest bidder (if any).
    """
    from core.database import SessionLocal
    from models.auction import Auction
    from models.bid import Bid
    from models.order import Order

    while True:
        await asyncio.sleep(30)
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            
            # Transition Upcoming -> Live
            started = (
                db.query(Auction)
                .filter(Auction.status == "upcoming", Auction.start_time <= now)
                .all()
            )
            for auction in started:
                auction.status = "live"
            
            # Transition Live -> Closed
            expired = (
                db.query(Auction)
                .filter(Auction.status == "live", Auction.end_time <= now)
                .all()
            )
            for auction in expired:
                auction.status = "closed"
                highest_bid = (
                    db.query(Bid)
                    .filter(Bid.auction_id == auction.id)
                    .order_by(Bid.amount.desc())
                    .first()
                )
                if highest_bid:
                    order = Order(
                        buyer_id=highest_bid.buyer_id,
                        auction_id=auction.id,
                        product_id=auction.product_id,
                        total_amount=highest_bid.amount,
                        status="pending",
                    )
                    db.add(order)

            if started or expired:
                db.commit()
                if started:
                    logger.info(f"[auction_manager] Started {len(started)} upcoming auction(s)")
                if expired:
                    logger.info(f"[auction_manager] Closed {len(expired)} expired auction(s)")

        except Exception as exc:
            logger.warning(f"[auction_manager] Skipped: {type(exc).__name__}: {exc}")
            db.rollback()
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_auction_manager())
    logger.info("[auction_manager] Background task started (runs every 30s)")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Smart Vegetable Market API", lifespan=lifespan)

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST routers ──────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(products_router, prefix="/products", tags=["Products"])
app.include_router(auctions_router, prefix="/auctions", tags=["Auctions"])
app.include_router(orders_router, prefix="/orders", tags=["Orders"])
app.include_router(payments_router, prefix="/payments", tags=["Payments"])
app.include_router(deliveries_router, prefix="/deliveries", tags=["Deliveries"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])


# ── WebSocket route ───────────────────────────────────────────────────────────
@app.websocket("/ws/auctions/{auction_id}")
async def ws_auctions(websocket: WebSocket, auction_id: int):
    await auction_ws_endpoint(websocket, auction_id)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok"}
