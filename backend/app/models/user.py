from sqlalchemy import Column, Integer, String, Enum, Boolean, TIMESTAMP, func
from core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("buyer", "farmer", "rider", "admin"), nullable=False)
    phone = Column(String(50), nullable=True)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
