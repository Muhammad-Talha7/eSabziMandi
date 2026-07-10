from sqlalchemy import Column, Integer, DECIMAL, TIMESTAMP, Enum, ForeignKey, func
from core.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    buyer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id", ondelete="SET NULL"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    total_amount = Column(DECIMAL(10, 2), nullable=False)
    status = Column(Enum("pending", "confirmed", "delivered", "cancelled"), nullable=False, default="pending")
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
