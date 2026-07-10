from sqlalchemy import (
    Column, Integer, String, Enum, DECIMAL, TIMESTAMP, Text, ForeignKey, func
)
from core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    farmer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    starting_price = Column(DECIMAL(10, 2), nullable=False, default=0.0)
    quantity = Column(DECIMAL(10, 2), nullable=False)
    unit = Column(String(50), nullable=False)
    image_url = Column(Text, nullable=True)
    status = Column(Enum("active", "sold", "removed"), nullable=False, default="active")
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
