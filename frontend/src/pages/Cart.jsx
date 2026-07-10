import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import api from '../api/axios';

const Cart = () => {
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useCart();
  const [checkoutState, setCheckoutState] = useState({ active: false, current: 0, total: 0, succeeded: [], failed: [] });
  const navigate = useNavigate();

  const totalAmount = cartItems.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.quantity), 0);

  const handleCheckout = async () => {
    setCheckoutState({ active: true, current: 0, total: cartItems.length, succeeded: [], failed: [] });
    
    let localSucceeded = [];
    let localFailed = [];

    for (let i = 0; i < cartItems.length; i++) {
      const item = cartItems[i];
      setCheckoutState(prev => ({ ...prev, current: i + 1 }));
      
      try {
        await api.post('/orders/direct', { product_id: item.product.id, quantity: item.quantity });
        localSucceeded.push(item);
        removeFromCart(item.product.id);
      } catch (err) {
        const errorMsg = err.response?.data?.detail || "Checkout failed";
        localFailed.push({ item, reason: typeof errorMsg === 'string' ? errorMsg : "Failed" });
      }
    }

    setCheckoutState(prev => ({ ...prev, succeeded: localSucceeded, failed: localFailed }));
  };

  if (cartItems.length === 0 && !checkoutState.active) {
    return (
      <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 8) 0', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-ink)' }}>Your cart is empty</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: 'calc(var(--spacing-unit) * 3)' }}>Looks like you haven't added any vegetables to your cart yet.</p>
        <Link to="/products"><button className="btn-primary">Browse Marketplace</button></Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 4) calc(var(--spacing-unit) * 2)', maxWidth: '900px' }}>
      <h1 style={{ marginTop: 0, color: 'var(--color-ink)' }}>Shopping Cart</h1>
      
      {checkoutState.active && (
        <div style={{ 
          background: checkoutState.current === checkoutState.total ? 'var(--color-primary-light)' : '#f9fbfd', 
          border: '1px solid var(--color-border)', 
          borderRadius: 'var(--radius)',
          padding: 'calc(var(--spacing-unit) * 3)',
          marginBottom: 'calc(var(--spacing-unit) * 4)'
        }}>
          <h3 style={{ marginTop: 0 }}>
            {checkoutState.current < checkoutState.total ? 'Processing Checkout...' : 'Checkout Complete'}
          </h3>
          <p>Processed {checkoutState.current} of {checkoutState.total} items.</p>
          
          {checkoutState.succeeded.length > 0 && (
            <div style={{ color: 'var(--color-success)', fontWeight: '500', marginBottom: '8px' }}>
              Successfully ordered: {checkoutState.succeeded.map(i => i.product.name).join(', ')}
            </div>
          )}
          
          {checkoutState.failed.length > 0 && (
            <div style={{ color: 'var(--color-error)', fontWeight: '500' }}>
              Failed to order: 
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                {checkoutState.failed.map((f, i) => (
                  <li key={i}>{f.item.product.name} ({f.reason})</li>
                ))}
              </ul>
            </div>
          )}
          
          {checkoutState.current === checkoutState.total && (
            <div style={{ marginTop: 'calc(var(--spacing-unit) * 3)' }}>
               {checkoutState.succeeded.length > 0 && (
                 <button className="btn-primary" onClick={() => navigate('/orders')} style={{ marginRight: '16px' }}>View My Orders</button>
               )}
               <button className="btn-secondary" onClick={() => setCheckoutState({ active: false, current: 0, total: 0, succeeded: [], failed: [] })}>
                 Continue Shopping
               </button>
            </div>
          )}
        </div>
      )}

      {!checkoutState.active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--spacing-unit) * 2)' }}>
          {cartItems.map(item => (
            <div key={item.product.id} style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--color-white)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: 'calc(var(--spacing-unit) * 2)',
              gap: 'calc(var(--spacing-unit) * 3)'
            }}>
              <div style={{ width: '80px', height: '80px', background: 'var(--color-primary-light)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                 {item.product.image_url ? (
                    <img src={item.product.image_url} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 'bold' }}>No Img</div>
                  )}
              </div>
              
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', color: 'var(--color-ink)' }}>
                  <Link to={`/products/${item.product.id}`} style={{ textDecoration: 'underline' }}>{item.product.name}</Link>
                </h3>
                <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                  Rs {parseFloat(item.product.price).toFixed(2)} / {item.product.unit}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--spacing-unit) * 2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Qty</label>
                  <input 
                    type="number" 
                    value={item.quantity}
                    min="1"
                    max={item.product.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) updateQuantity(item.product.id, val);
                    }}
                    style={{ width: '80px', padding: '4px 8px' }}
                  />
                </div>
                
                <div style={{ width: '100px', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Line Total</div>
                  <div style={{ fontWeight: 'bold', color: 'var(--color-ink)', fontSize: '1.125rem' }}>
                    Rs {(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                  </div>
                </div>
                
                <button 
                  onClick={() => removeFromCart(item.product.id)}
                  style={{ color: 'var(--color-error)', border: 'none', background: 'none', cursor: 'pointer', padding: '8px', fontSize: '1.25rem' }}
                  title="Remove item"
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: '#f9fbfd',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 'calc(var(--spacing-unit) * 3)',
            marginTop: 'calc(var(--spacing-unit) * 2)'
          }}>
            <button className="btn-secondary" onClick={clearCart}>Clear Cart</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--spacing-unit) * 4)' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Grand Total</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                  Rs {totalAmount.toFixed(2)}
                </div>
              </div>
              <button className="btn-primary" onClick={handleCheckout} style={{ fontSize: '1.125rem' }}>
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
