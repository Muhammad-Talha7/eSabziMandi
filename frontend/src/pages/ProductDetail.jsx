import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';
import { useCart } from '../context/CartContext';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, token } = useAuth();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState(null);
  const [activeAuction, setActiveAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const [res, auctionsRes] = await Promise.all([
          api.get(`/products/${id}`),
          api.get('/auctions/', { params: { auction_status: 'live,upcoming' } })
        ]);
        setProduct(res.data);
        
        const auction = auctionsRes.data.find(a => 
          a.product_id === parseInt(id) && 
          (a.status === 'live' || a.status === 'upcoming')
        );
        if (auction) {
          setActiveAuction(auction);
        }
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setNotFound(true);
        }
        console.error("Error fetching product", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handlePurchase = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    setPurchaseLoading(true);
    setError('');
    
    try {
      await api.post('/orders/direct', { product_id: product.id, quantity });
      setSuccess(true);
      // Update local quantity
      setProduct(prev => ({
        ...prev,
        quantity: prev.quantity - quantity,
        status: (prev.quantity - quantity) <= 0 ? 'sold' : prev.status
      }));
      setQuantity(1);
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        const detail = err.response.data.detail;
        setError(typeof detail === 'string' ? detail : "Invalid purchase request.");
      } else {
        setError("Failed to purchase item. Please try again.");
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-muted)' }}>Loading product details...</p>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 8) 0', textAlign: 'center' }}>
        <h2>Product Not Found</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: 'calc(var(--spacing-unit) * 3)' }}>The item you are looking for does not exist or has been removed.</p>
        <Link to="/products"><button className="btn-primary">Back to Marketplace</button></Link>
      </div>
    );
  }

  const isAvailable = product.status === 'active' && parseFloat(product.quantity) > 0;
  const maxQuantity = parseFloat(product.quantity);

  return (
    <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 4) calc(var(--spacing-unit) * 2)' }}>
      <Link to="/products" style={{ color: 'var(--color-muted)', display: 'inline-block', marginBottom: 'calc(var(--spacing-unit) * 3)' }}>
        ← Back to Marketplace
      </Link>
      
      {success && (
        <div style={{ 
          background: 'var(--color-primary-light)', 
          border: '1px solid var(--color-primary)', 
          padding: 'calc(var(--spacing-unit) * 2)', 
          borderRadius: 'var(--radius)',
          marginBottom: 'calc(var(--spacing-unit) * 3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong style={{ color: 'var(--color-primary-dark)' }}>Order placed successfully!</strong>
            <div style={{ color: 'var(--color-primary-dark)', fontSize: '0.875rem' }}>Your purchase has been confirmed.</div>
          </div>
          <Link to="/orders"><button className="btn-primary">View My Orders</button></Link>
        </div>
      )}

      {error && <div className="error-message" style={{ marginBottom: 'calc(var(--spacing-unit) * 3)' }}>{error}</div>}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 'calc(var(--spacing-unit) * 4)' 
      }}>
        {/* Product Image */}
        <div style={{ 
          background: 'var(--color-primary-light)', 
          aspectRatio: '1 / 1', 
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: 'var(--color-primary)', fontWeight: '500', fontSize: '1.5rem' }}>No Image</span>
          )}
        </div>

        {/* Product Info */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            fontSize: '0.875rem', 
            color: 'var(--color-muted)', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'calc(var(--spacing-unit) * 1)'
          }}>
            {product.category}
          </div>
          
          <h1 style={{ margin: '0 0 calc(var(--spacing-unit) * 2) 0', color: 'var(--color-ink)' }}>{product.name}</h1>
          
          <div style={{ marginBottom: 'calc(var(--spacing-unit) * 4)' }}>
            {activeAuction ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>{activeAuction.status === 'live' ? 'Current Bid:' : 'Starting Price:'}</span>
                <span style={{ fontWeight: 'bold', fontSize: '2rem', color: 'var(--color-primary)' }}>
                  Rs {parseFloat(activeAuction.current_price).toFixed(2)}
                </span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>Buy Now Price:</span>
                  <span style={{ fontWeight: 'bold', fontSize: '2rem', color: 'var(--color-primary)' }}>
                    Rs {parseFloat(product.price).toFixed(2)}
                  </span>
                  <span style={{ color: 'var(--color-muted)' }}> / {product.unit}</span>
                </div>
                {product.starting_price && parseFloat(product.starting_price) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>Auction Starting Price:</span>
                    <span style={{ fontWeight: '500', fontSize: '1.25rem', color: 'var(--color-ink)' }}>
                      Rs {parseFloat(product.starting_price).toFixed(2)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ 
            borderTop: '1px solid var(--color-border)', 
            borderBottom: '1px solid var(--color-border)', 
            padding: 'calc(var(--spacing-unit) * 2) 0',
            marginBottom: 'calc(var(--spacing-unit) * 4)'
          }}>
            <p style={{ margin: '0 0 calc(var(--spacing-unit) * 1) 0', color: 'var(--color-ink)' }}>
              <strong>Available Stock:</strong> {maxQuantity} {product.unit}
            </p>
            <p style={{ margin: 0, color: 'var(--color-ink)' }}>
              <strong>Farmer ID:</strong> {product.farmer_id}
            </p>
          </div>

          {/* Purchasing Logic */}
          {activeAuction ? (
            <div style={{ 
              background: 'var(--color-primary-light)', 
              border: '1px solid var(--color-primary)', 
              padding: 'calc(var(--spacing-unit) * 3)', 
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>
                {activeAuction.status === 'live' ? 'Live Auction Active!' : 'Auction Upcoming!'}
              </h3>
              <p style={{ margin: 0, color: 'var(--color-ink)', fontSize: '0.875rem' }}>
                {activeAuction.status === 'live' 
                  ? 'This product is currently being auctioned. You can place your bids in the auction room.'
                  : 'An auction for this product will start soon. Check the auction room for details.'}
              </p>
              <Link to={`/auction/${activeAuction.id}`}>
                <button className="btn-primary" style={{ width: '100%' }}>Enter Auction Room</button>
              </Link>
            </div>
          ) : !isAvailable ? (
            <div style={{ 
              background: '#f9fbfd', 
              border: '1px solid var(--color-border)', 
              padding: 'calc(var(--spacing-unit) * 3)', 
              borderRadius: 'var(--radius)',
              textAlign: 'center'
            }}>
              <h3 style={{ margin: 0, color: 'var(--color-error)' }}>Sold Out</h3>
              <p style={{ margin: 'calc(var(--spacing-unit) * 1) 0 0 0', color: 'var(--color-muted)', fontSize: '0.875rem' }}>This item is no longer available.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--spacing-unit) * 2)' }}>
              <div>
                <label htmlFor="quantity">Quantity ({product.unit})</label>
                <input 
                  type="number" 
                  id="quantity" 
                  min="1" 
                  max={maxQuantity} 
                  value={quantity} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setQuantity(Math.min(Math.max(val, 1), maxQuantity));
                    else setQuantity(e.target.value); // allow empty string temporarily while typing
                  }}
                  onBlur={() => {
                    if (quantity === '' || isNaN(quantity)) setQuantity(1);
                  }}
                  style={{ width: '150px' }}
                />
              </div>

              {!token ? (
                <button className="btn-primary" onClick={() => navigate('/login')} style={{ width: 'fit-content' }}>
                  Login to Buy
                </button>
              ) : role === 'buyer' ? (
                <div style={{ display: 'flex', gap: 'calc(var(--spacing-unit) * 2)' }}>
                  <button 
                    className="btn-primary" 
                    onClick={handlePurchase} 
                    disabled={purchaseLoading || quantity > maxQuantity || quantity <= 0}
                    style={{ width: 'fit-content', opacity: purchaseLoading ? 0.7 : 1 }}
                  >
                    {purchaseLoading ? 'Processing...' : 'Buy now'}
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => {
                       addToCart(product, quantity);
                       // Optional: could show a small toast, but simple reset is fine for now
                       setSuccess(true);
                       setTimeout(() => setSuccess(false), 2000);
                    }} 
                    disabled={purchaseLoading || quantity > maxQuantity || quantity <= 0}
                    style={{ width: 'fit-content' }}
                  >
                    Add to Cart
                  </button>
                </div>
              ) : (
                <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem', background: '#f9fbfd', padding: 'calc(var(--spacing-unit) * 2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
                  Only buyers can purchase items directly. (You are logged in as a {role})
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
