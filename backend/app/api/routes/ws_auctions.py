"""
WebSocket endpoint for real-time auction bidding.

Connect:  ws://host/ws/auctions/{auction_id}?token=<JWT>

Client sends:    {"amount": 150.00}

Broadcast on success:
    {"event": "bid_placed", "auction_id": 1, "bid_id": 42,
     "buyer_id": 7, "buyer_name": "Ali", "amount": 150.0, "current_price": 150.0}

Error (to sender only):
    {"event": "error", "detail": "..."}
"""

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Dict, List

from fastapi import WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from core.config import settings
from core.database import SessionLocal
from models.auction import Auction
from models.bid import Bid
from models.user import User


# ── In-memory room manager ──────────────────────────────────────────────────

_rooms: Dict[int, List[WebSocket]] = {}


def _get_room(auction_id: int) -> List[WebSocket]:
    return _rooms.setdefault(auction_id, [])


async def _broadcast(auction_id: int, message: dict) -> None:
    """Send JSON to every client in the room. Silently prune dead sockets."""
    room = _get_room(auction_id)
    dead: List[WebSocket] = []
    for ws in room:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        room.remove(ws)


async def _send_error(ws: WebSocket, detail: str) -> None:
    await ws.send_json({"event": "error", "detail": detail})


# ── JWT auth for WebSockets (can't use FastAPI Depends) ─────────────────────

def _authenticate_ws(token: str, db) -> User | None:
    """
    Decode the JWT and fetch the user from the DB.
    Returns None on any failure — caller decides how to close the socket.

    NOTE: We intentionally decode the JWT directly here (not via
    utils.security.decode_access_token) because that function raises
    an HTTPException, which is meaningless inside a WebSocket handler.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    return db.query(User).filter(User.id == int(user_id)).first()


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── WebSocket handler (mounted in main.py) ──────────────────────────────────

async def auction_ws_endpoint(websocket: WebSocket, auction_id: int) -> None:
    """
    Full lifecycle for one WebSocket client in an auction room.
    Auth via ?token=<JWT> query parameter.
    """
    token = websocket.query_params.get("token")
    db = SessionLocal()

    try:
        # ── 1. Auth gate ─────────────────────────────────────────────────────
        if not token:
            await websocket.close(code=4001, reason="Missing token query param")
            return

        user = _authenticate_ws(token, db)
        if user is None:
            await websocket.close(code=4001, reason="Invalid or expired token")
            return

        if user.role != "buyer":
            await websocket.close(code=4003, reason="Only buyers can place bids")
            return

        # ── 2. Accept & join room ────────────────────────────────────────────
        await websocket.accept()
        room = _get_room(auction_id)
        room.append(websocket)

        await websocket.send_json({
            "event": "connected",
            "auction_id": auction_id,
            "user_id": user.id,
            "message": f"Joined auction room #{auction_id}",
        })

        # ── 3. Message loop ─────────────────────────────────────────────────
        while True:
            data = await websocket.receive_json()

            # -- Parse amount --
            raw_amount = data.get("amount")
            if raw_amount is None:
                await _send_error(websocket, "Message must contain an 'amount' field")
                continue

            try:
                bid_amount = Decimal(str(raw_amount))
            except (InvalidOperation, ValueError):
                await _send_error(websocket, "Invalid amount value")
                continue

            # -- Refresh session to pick up changes from other connections --
            db.expire_all()
            auction = db.query(Auction).filter(Auction.id == auction_id).first()

            if auction is None:
                await _send_error(websocket, "Auction not found")
                continue

            # -- Validate auction is live & in time window --
            if auction.status != "live":
                await _send_error(
                    websocket,
                    f"Auction is not live (current status: {auction.status})",
                )
                continue

            now = _utc_now_naive()
            if not (auction.start_time <= now <= auction.end_time):
                await _send_error(websocket, "Auction is outside its active time window")
                continue

            # -- Validate bid amount > current_price --
            if bid_amount <= Decimal(str(auction.current_price)):
                await _send_error(
                    websocket,
                    f"Bid must be greater than current price ({auction.current_price})",
                )
                continue

            # -- Commit bid --
            bid = Bid(auction_id=auction_id, buyer_id=user.id, amount=bid_amount)
            db.add(bid)
            auction.current_price = bid_amount
            db.commit()
            db.refresh(bid)

            # -- Broadcast to entire room --
            await _broadcast(auction_id, {
                "event": "bid_placed",
                "auction_id": auction_id,
                "bid_id": bid.id,
                "buyer_id": user.id,
                "buyer_name": user.name,
                "amount": float(bid_amount),
                "current_price": float(bid_amount),
            })

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"event": "error", "detail": str(exc)})
            await websocket.close()
        except Exception:
            pass
    finally:
        room = _get_room(auction_id)
        if websocket in room:
            room.remove(websocket)
        # Clean up empty rooms
        if not _get_room(auction_id):
            _rooms.pop(auction_id, None)
        db.close()
