import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const OrderCard = ({ order, onPaymentSuccess }) => {
  const [expanded, setExpanded] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const fetchDelivery = async () => {
    setDeliveryLoading(true);
    try {
      const res = await api.get(`/deliveries/order/${order.id}`);
      setDelivery(res.data);
    } catch (err) {
      if (err.response?.status !== 404) {
         console.error("Failed to load delivery", err);
      }
      setDelivery(null);
    } finally {
      setDeliveryLoading(false);
    }
  };

  const handleExpand = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (newExpanded && order.status !== 'pending' && !delivery) {
      fetchDelivery();
    }
  };

  const handlePayment = async () => {
    setPaymentLoading(true);
    setPaymentError('');
    try {
      await api.post('/payments/', { order_id: order.id, method: paymentMethod });
      onPaymentSuccess(order.id);
    } catch (err) {
      setPaymentError(err.response?.data?.detail || "Payment failed");
    } finally {
      setPaymentLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f39c12';
      case 'confirmed': return 'var(--color-primary)';
      case 'delivered': return 'var(--color-success)';
      case 'cancelled': return 'var(--color-error)';
      default: return 'var(--color-muted)';
    }
  };

  return (
    <div style={{ 
      background: 'var(--color-white)', 
      border: '1px solid var(--color-border)', 
      borderRadius: 'var(--radius)', 
      padding: 'calc(var(--spacing-unit) * 2)',
      marginBottom: 'calc(var(--spacing-unit) * 2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={handleExpand}>
        <div>
          <div style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>Order #{order.id}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
            {new Date(order.created_at + 'Z').toLocaleString()}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--spacing-unit) * 4)' }}>
          <div style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>
            Rs {parseFloat(order.total_amount).toFixed(2)}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor(order.status) }} />
            <span style={{ fontSize: '0.875rem', textTransform: 'capitalize', color: 'var(--color-ink)', fontWeight: '500' }}>
              {order.status}
            </span>
          </div>
          
          <div style={{ color: 'var(--color-muted)' }}>
            {expanded ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ 
          marginTop: 'calc(var(--spacing-unit) * 2)', 
          paddingTop: 'calc(var(--spacing-unit) * 2)', 
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'calc(var(--spacing-unit) * 2)'
        }}>
          <div>
             <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem', textTransform: 'uppercase' }}>Source: </span>
             <Link to={order.auction_id ? `/auction/${order.auction_id}` : `/products/${order.product_id}`} style={{ textDecoration: 'underline' }}>
               {order.auction_id ? `Auction #${order.auction_id}` : `Direct Purchase (Product #${order.product_id})`}
             </Link>
          </div>

          {order.status === 'pending' && (
            <div style={{ background: 'var(--color-primary-light)', padding: 'calc(var(--spacing-unit) * 2)', borderRadius: 'var(--radius)' }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-primary-dark)' }}>Complete Payment</h4>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={paymentLoading} style={{ width: 'auto' }}>
                  <option value="card">Credit/Debit Card</option>
                  <option value="easypaisa">Easypaisa</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="cod">Cash on Delivery</option>
                </select>
                <button className="btn-primary" onClick={handlePayment} disabled={paymentLoading}>
                  {paymentLoading ? 'Processing...' : 'Pay Now'}
                </button>
              </div>
              {paymentError && <div style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginTop: '8px' }}>{paymentError}</div>}
            </div>
          )}

          {order.status !== 'pending' && (
            <div>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem', textTransform: 'uppercase' }}>Delivery Status: </span>
              {deliveryLoading ? (
                <span>Loading...</span>
              ) : delivery ? (
                <span style={{ fontWeight: '500', color: 'var(--color-ink)', textTransform: 'capitalize' }}>
                  {delivery.status} (Rider #{delivery.rider_id})
                </span>
              ) : (
                <span style={{ color: 'var(--color-muted)' }}>Not yet assigned</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get('/orders/me');
        setOrders(res.data);
      } catch (err) {
        console.error("Failed to load orders", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const handlePaymentSuccess = (orderId) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'confirmed' } : o));
  };

  if (loading) {
    return <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 8) 0', textAlign: 'center', color: 'var(--color-muted)' }}>Loading orders...</div>;
  }

  return (
    <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 4) calc(var(--spacing-unit) * 2)', maxWidth: '900px' }}>
      <h1 style={{ marginTop: 0, color: 'var(--color-ink)' }}>Order History</h1>
      
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'calc(var(--spacing-unit) * 8) 0', background: 'var(--color-white)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius)' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>No orders found</h3>
          <p style={{ color: 'var(--color-muted)', marginBottom: 'calc(var(--spacing-unit) * 3)' }}>You haven't placed any orders yet.</p>
          <Link to="/products"><button className="btn-primary">Start Shopping</button></Link>
        </div>
      ) : (
        <div>
          {orders.map(order => (
            <OrderCard key={order.id} order={order} onPaymentSuccess={handlePaymentSuccess} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
