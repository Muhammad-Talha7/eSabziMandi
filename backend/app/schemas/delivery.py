from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class DeliveryStatusEnum(str, Enum):
    assigned = "assigned"
    picked_up = "picked_up"
    delivered = "delivered"


# ── Request schemas ──────────────────────────────────────────────────────────

class DeliveryAssign(BaseModel):
    rider_id: int


class DeliveryStatusUpdate(BaseModel):
    status: DeliveryStatusEnum


# ── Response schemas ─────────────────────────────────────────────────────────

class DeliveryOut(BaseModel):
    id: int
    order_id: int
    rider_id: int
    status: DeliveryStatusEnum
    picked_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

    class Config:
        from_attributes = True
