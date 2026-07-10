from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user, get_current_user_role
from models.order import Order
from models.payment import Payment
from schemas.payment import PaymentCreate, PaymentOut
from services.mock_gateway import MockPaymentGateway

router = APIRouter()

_gateway = MockPaymentGateway()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_order_or_404(order_id: int, db: Session) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return order


def _get_payment_or_404(payment_id: int, db: Session) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    return payment


def _assert_order_owner(order: Order, current_user) -> None:
    """Raise 403 if the current user is not the buyer of the order."""
    if order.buyer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this order's payments",
        )


# ── POST /payments ── buyer only, must own the order ─────────────────────────

@router.post("/", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["buyer"])),
):
    """
    Initiate a payment for an existing order.

    - The caller must be a **buyer** and must own the order.
    - Delegates to MockPaymentGateway (swappable with a real gateway later).
    - On success  → creates a Payment row and sets order.status = "confirmed".
    - On failure  → creates a Payment row with status "failed"; order stays
      "pending" so the buyer can retry.
    """
    order = _get_order_or_404(payload.order_id, db)
    _assert_order_owner(order, current_user)

    # Process via gateway (async — awaits simulated network delay).
    result = await _gateway.process_payment(
        amount=float(order.total_amount),
        method=payload.method.value,
        order_id=order.id,
    )

    # Persist payment record.
    payment = Payment(
        order_id=order.id,
        method=payload.method.value,
        amount=order.total_amount,
        status=result.status,
        transaction_ref=result.transaction_ref,
    )
    db.add(payment)

    # Update order status only on success.
    if result.status == "success":
        order.status = "confirmed"

    db.commit()
    db.refresh(payment)
    return payment


# ── GET /payments/order/{order_id} ── must come BEFORE /{id} to avoid clash ──

@router.get("/order/{order_id}", response_model=list[PaymentOut])
def list_payments_for_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List all payment attempts for a given order (supports retry history).

    - Buyer who owns the order, **or** admin.
    """
    order = _get_order_or_404(order_id, db)

    if current_user.role != "admin":
        _assert_order_owner(order, current_user)

    return (
        db.query(Payment)
        .filter(Payment.order_id == order_id)
        .order_by(Payment.created_at.asc())
        .all()
    )


# ── GET /payments/{id} ── buyer who owns it, or admin ────────────────────────

@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Retrieve a single payment by ID.

    - Buyer who owns the associated order, **or** admin.
    """
    payment = _get_payment_or_404(payment_id, db)

    if current_user.role != "admin":
        order = _get_order_or_404(payment.order_id, db)
        _assert_order_owner(order, current_user)

    return payment
