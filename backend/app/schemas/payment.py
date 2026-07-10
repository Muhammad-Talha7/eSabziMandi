from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class PaymentMethodEnum(str, Enum):
    card = "card"
    easypaisa = "easypaisa"
    jazzcash = "jazzcash"
    cod = "cod"


class PaymentStatusEnum(str, Enum):
    pending = "pending"
    success = "success"
    failed = "failed"


# ── Request schemas ──────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    order_id: int
    method: PaymentMethodEnum


# ── Response schemas ─────────────────────────────────────────────────────────

class PaymentOut(BaseModel):
    id: int
    order_id: int
    method: PaymentMethodEnum
    amount: Decimal
    status: PaymentStatusEnum
    transaction_ref: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
