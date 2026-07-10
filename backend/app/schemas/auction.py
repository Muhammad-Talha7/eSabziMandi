from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional


class AuctionStatusEnum(str, Enum):
    upcoming = "upcoming"
    live = "live"
    closed = "closed"


# ── Auction request schemas ──────────────────────────────────

class AuctionCreate(BaseModel):
    product_id: int
    starting_price: Decimal
    start_time: datetime
    end_time: datetime


# ── Auction response schemas ─────────────────────────────────

class AuctionOut(BaseModel):
    id: int
    product_id: int
    starting_price: Decimal
    current_price: Decimal
    start_time: datetime
    end_time: datetime
    status: AuctionStatusEnum

    class Config:
        from_attributes = True


class AuctionDetail(AuctionOut):
    """Extended response for the single-auction detail endpoint."""
    highest_bid: Optional[Decimal] = None
    highest_bidder_id: Optional[int] = None


# ── Bid schemas ──────────────────────────────────────────────

class BidCreate(BaseModel):
    amount: Decimal


class BidOut(BaseModel):
    id: int
    auction_id: int
    buyer_id: int
    amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True
