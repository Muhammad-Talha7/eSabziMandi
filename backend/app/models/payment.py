from sqlalchemy import Column, Integer, String, DECIMAL, TIMESTAMP, Enum, ForeignKey, func
from core.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    method = Column(
        Enum("card", "easypaisa", "jazzcash", "cod"),
        nullable=False,
    )
    amount = Column(DECIMAL(10, 2), nullable=False)
    status = Column(
        Enum("pending", "success", "failed"),
        nullable=False,
        default="pending",
    )
    transaction_ref = Column(String(255), nullable=True)
    created_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        nullable=False,
    )
