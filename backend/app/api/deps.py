from typing import Generator, List

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from core.database import SessionLocal
from utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db),
):
    from models.user import User  # local import to avoid circular deps

    payload = decode_access_token(token)  # raises 401 on invalid
    user_id: int = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_role(required_roles: List[str]):
    """
    Dependency factory for role-based access control.

    Usage:
        @router.get("/admin-only")
        def admin_route(user = Depends(get_current_user_role(["admin"]))):
            ...
    """
    def role_checker(current_user=Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to roles: {required_roles}",
            )
        return current_user

    return role_checker

get_admin_user = get_current_user_role(["admin"])

def get_product_owner(required_roles: List[str] = None):
    """
    Dependency factory that fetches a product by path param `product_id`,
    verifies the current user owns it (farmer_id == current_user.id),
    and returns the product.

    Usage:
        @router.put("/{product_id}")
        def update(product=Depends(get_product_owner()), ...):
            ...
    """
    def ownership_checker(
        product_id: int,
        db=Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        from models.product import Product  # local import to avoid circular deps

        product = db.query(Product).filter(Product.id == product_id).first()
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found",
            )
        if product.farmer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify this product",
            )
        return product

    return ownership_checker


def get_delivery_access():
    """
    Dependency factory that fetches a delivery by path param `delivery_id`,
    verifies the current user has access (buyer of the order, assigned rider, or admin),
    and returns the delivery.
    """
    def access_checker(
        delivery_id: int,
        db=Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        from models.delivery import Delivery
        from models.order import Order

        delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
        if delivery is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Delivery not found",
            )
        
        if current_user.role == "admin":
            return delivery
        if current_user.id == delivery.rider_id:
            return delivery
            
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order and order.buyer_id == current_user.id:
            return delivery
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this delivery",
        )

    return access_checker
