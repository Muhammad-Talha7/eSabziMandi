from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import get_db, get_current_user, get_current_user_role, get_product_owner
from models.product import Product
from schemas.product import ProductCreate, ProductUpdate, ProductOut

router = APIRouter()


# ──────────────────────────────────────────────
# POST /products  — farmer only, create a product
# ──────────────────────────────────────────────
@router.post("/", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["farmer"])),
):
    """
    Create a new product.
    - Only users with role 'farmer' can create products.
    """
    if payload.price <= payload.starting_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Buy Now price must be strictly higher than Auction Starting price"
        )
        
    product = Product(
        farmer_id=current_user.id,
        name=payload.name,
        category=payload.category,
        price=payload.price,
        quantity=payload.quantity,
        unit=payload.unit,
        image_url=payload.image_url,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


# ──────────────────────────────────────────────
# GET /products  — public, with filters + pagination
# ──────────────────────────────────────────────
@router.get("/", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    category: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    status: Optional[str] = Query("active"),
    search: Optional[str] = Query(None, description="Search by product name"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Public product listing with optional filters and pagination."""
    q = db.query(Product)

    if status:
        q = q.filter(Product.status == status)
    if category:
        q = q.filter(Product.category == category)
    if min_price is not None:
        q = q.filter(Product.price >= min_price)
    if max_price is not None:
        q = q.filter(Product.price <= max_price)
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%"))

    offset = (page - 1) * limit
    return q.order_by(Product.created_at.desc()).offset(offset).limit(limit).all()


# ──────────────────────────────────────────────
# GET /products/farmer/me  — farmer's own products (any status)
# Must be declared BEFORE /{id} to avoid route conflict
# ──────────────────────────────────────────────
@router.get("/farmer/me", response_model=list[ProductOut])
def my_products(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_role(["farmer"])),
):
    """List all products (any status) belonging to the currently logged-in farmer."""
    return (
        db.query(Product)
        .filter(Product.farmer_id == current_user.id)
        .order_by(Product.created_at.desc())
        .all()
    )


# ──────────────────────────────────────────────
# GET /products/{id}  — public, single product
# ──────────────────────────────────────────────
@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Fetch a single product by ID (public)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


# ──────────────────────────────────────────────
# PUT /products/{id}  — owner farmer only, partial update
# ──────────────────────────────────────────────
@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    product=Depends(get_product_owner()),
):
    """Partially update a product. Only the owning farmer can update."""
    if payload.price is not None and payload.starting_price is not None:
        if payload.price <= payload.starting_price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Buy Now price must be strictly higher than Auction Starting price"
            )
    elif payload.price is not None:
        if payload.price <= product.starting_price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Buy Now price must be strictly higher than current Auction Starting price"
            )
    elif payload.starting_price is not None:
        if product.price <= payload.starting_price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Auction Starting price must be strictly lower than current Buy Now price"
            )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


# ──────────────────────────────────────────────
# DELETE /products/{id}  — soft delete (status="removed"), owner only
# ──────────────────────────────────────────────
@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    db: Session = Depends(get_db),
    product=Depends(get_product_owner()),
):
    """Soft-delete a product by setting status to 'removed'. Owner only."""
    product.status = "removed"
    db.commit()
