from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from api.deps import get_db, get_admin_user
from models.user import User
from models.order import Order
from models.product import Product
from models.auction import Auction
from models.payment import Payment
from models.delivery import Delivery
from schemas.user import UserOut, UserVerify
from schemas.order import FarmerOrderOut
from pydantic import BaseModel

router = APIRouter()

class AdminStatsOut(BaseModel):
    total_users: dict
    total_products: dict
    total_orders: dict
    total_revenue: float

@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
    role: Optional[str] = Query(None, description="Filter by role"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

@router.get("/orders", response_model=list[FarmerOrderOut])
def list_all_orders(
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by order status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    query = db.query(Order, User).join(User, Order.buyer_id == User.id)
    if status_filter:
        query = query.filter(Order.status == status_filter)
        
    items = query.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    results = []
    for order, user in items:
        payment = db.query(Payment).filter(Payment.order_id == order.id).order_by(Payment.created_at.desc()).first()
        delivery = db.query(Delivery).filter(Delivery.order_id == order.id).first()

        out = FarmerOrderOut(
            id=order.id,
            buyer_id=order.buyer_id,
            auction_id=order.auction_id,
            product_id=order.product_id,
            total_amount=order.total_amount,
            status=order.status,
            created_at=order.created_at,
            buyer_name=user.name,
            buyer_email=user.email,
            buyer_phone=user.phone,
            payment_status=payment.status if payment else None,
            delivery_status=delivery.status if delivery else None
        )
        results.append(out)

    return results

@router.delete("/products/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_admin(
    id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user)
):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
    product.status = "removed"
    db.commit()
    # Log which admin performed this
    print(f"Admin override: Product {id} removed by admin {admin.id}")
    return None

@router.patch("/users/{id}/verify", response_model=UserOut)
def verify_user(
    id: int,
    payload: UserVerify,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user)
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    user.verified = payload.verified
    db.commit()
    db.refresh(user)
    return user

@router.get("/stats", response_model=AdminStatsOut)
def get_stats(
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user)
):
    # Users by role
    users_by_role = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    total_users = {role: count for role, count in users_by_role}

    # Products by status
    products_by_status = db.query(Product.status, func.count(Product.id)).group_by(Product.status).all()
    total_products = {status: count for status, count in products_by_status}

    # Orders by status
    orders_by_status = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    total_orders = {status: count for status, count in orders_by_status}

    # Total revenue (sum of successful payments)
    revenue_result = db.query(func.sum(Payment.amount)).filter(Payment.status == 'success').scalar()
    total_revenue = float(revenue_result) if revenue_result else 0.0

    return AdminStatsOut(
        total_users=total_users,
        total_products=total_products,
        total_orders=total_orders,
        total_revenue=total_revenue
    )
