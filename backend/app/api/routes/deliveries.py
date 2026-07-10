from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user, get_current_user_role, get_delivery_access
from models.order import Order
from models.delivery import Delivery
from schemas.delivery import DeliveryAssign, DeliveryStatusUpdate, DeliveryOut

router = APIRouter()


def _utc_now_naive() -> datetime:
    """Return current UTC time as a timezone-naive datetime."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── POST /deliveries ── admin only ───────────────────────────────────────────

@router.post("/", response_model=DeliveryOut, status_code=status.HTTP_201_CREATED)
def assign_delivery(
    order_id: int,
    payload: DeliveryAssign,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["admin"])),
):
    """
    Assign a rider to an order.
    - Requires order.status == "confirmed".
    - Creates delivery row with status "assigned".
    - 400 if order isn't confirmed or already has a delivery.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        
    if order.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Order must be 'confirmed' to assign delivery (current status: {order.status})"
        )
        
    existing_delivery = db.query(Delivery).filter(Delivery.order_id == order_id).first()
    if existing_delivery:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Order already has an assigned delivery"
        )
        
    delivery = Delivery(
        order_id=order_id,
        rider_id=payload.rider_id,
        status="assigned",
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return delivery


# ── GET /deliveries/rider/me ── rider only ───────────────────────────────────

@router.get("/rider/me", response_model=list[DeliveryOut])
def list_my_deliveries(
    db: Session = Depends(get_db),
    status_filter: str = None,
    current_user=Depends(get_current_user_role(["rider"])),
):
    """
    Lists all deliveries assigned to current rider, optionally filterable by status.
    """
    q = db.query(Delivery).filter(Delivery.rider_id == current_user.id)
    if status_filter:
        q = q.filter(Delivery.status == status_filter)
        
    # We don't have created_at on Delivery, we can sort by id desc
    return q.order_by(Delivery.id.desc()).all()


# ── GET /deliveries/order/{order_id} ── protected ────────────────────────────

@router.get("/order/{order_id}", response_model=DeliveryOut)
def get_delivery_for_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns delivery for a given order.
    - Protected: buyer who owns the order, assigned rider, or admin
    """
    delivery = db.query(Delivery).filter(Delivery.order_id == order_id).first()
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found for this order")
        
    # Access rules
    if current_user.role != "admin" and current_user.id != delivery.rider_id:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order or order.buyer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this delivery"
            )
            
    return delivery


# ── GET /deliveries/{delivery_id} ── protected ───────────────────────────────

@router.get("/{delivery_id}", response_model=DeliveryOut)
def get_delivery(
    delivery=Depends(get_delivery_access()),
):
    """
    Returns a delivery by ID.
    - Protected: buyer who owns the order, assigned rider, or admin
    """
    return delivery


# ── PATCH /deliveries/{delivery_id}/status ── assigned rider only ────────────

@router.patch("/{delivery_id}/status", response_model=DeliveryOut)
def update_delivery_status(
    delivery_id: int,
    payload: DeliveryStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["rider"])),
):
    """
    Update delivery status.
    - Only assigned rider.
    - Only forward transitions: assigned -> picked_up -> delivered.
    - Sets timestamps accordingly.
    - On "delivered", also update order.status to "delivered".
    """
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found")
        
    if delivery.rider_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this delivery")
        
    # Enforce forward transition only
    valid_transitions = {
        "assigned": ["picked_up"],
        "picked_up": ["delivered"],
        "delivered": [],
    }
    
    if payload.status.value not in valid_transitions[delivery.status]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition delivery from {delivery.status} to {payload.status.value}"
        )
        
    delivery.status = payload.status.value
    now = _utc_now_naive()
    
    if payload.status.value == "picked_up":
        delivery.picked_at = now
    elif payload.status.value == "delivered":
        delivery.delivered_at = now
        # Update order status
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = "delivered"
            
    db.commit()
    db.refresh(delivery)
    return delivery
