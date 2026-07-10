from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class OrderStatusEnum(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    delivered = "delivered"
    cancelled = "cancelled"


# ── Request schemas ──────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0, description="Must be greater than zero")


# ── Response schemas ─────────────────────────────────────────────────────────

class OrderOut(BaseModel):
    id: int
    buyer_id: int
    auction_id: Optional[int] = None
    product_id: Optional[int] = None
    total_amount: Decimal
    status: OrderStatusEnum
    created_at: datetime

    class Config:
        from_attributes = True

class FarmerOrderOut(OrderOut):
    buyer_name: str
    buyer_phone: Optional[str] = None
    buyer_email: str
    payment_status: Optional[str] = None
    delivery_status: Optional[str] = None
