from sqlalchemy import Column, Integer, DATETIME, Enum, ForeignKey
from core.database import Base


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rider_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        Enum("assigned", "picked_up", "delivered"),
        nullable=False,
        default="assigned",
    )
    picked_at = Column(DATETIME, nullable=True)
    delivered_at = Column(DATETIME, nullable=True)
