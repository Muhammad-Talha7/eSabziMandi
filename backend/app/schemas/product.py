from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional


class ProductStatusEnum(str, Enum):
    active = "active"
    sold = "sold"
    removed = "removed"


class ProductCreate(BaseModel):
    name: str
    category: str
    price: Decimal
    starting_price: Decimal
    quantity: Decimal
    unit: str
    image_url: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[Decimal] = None
    starting_price: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[ProductStatusEnum] = None


class ProductOut(BaseModel):
    id: int
    farmer_id: int
    name: str
    category: str
    price: Decimal
    starting_price: Decimal
    quantity: Decimal
    unit: str
    image_url: Optional[str] = None
    status: ProductStatusEnum
    created_at: datetime

    class Config:
        from_attributes = True
