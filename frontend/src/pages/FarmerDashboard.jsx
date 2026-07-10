import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';

const FarmerDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('products');
  
  const [products, setProducts] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [farmerOrders, setFarmerOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [productModal, setProductModal] = useState({ isOpen: false, type: 'add', data: null });
  const [auctionModal, setAuctionModal] = useState({ isOpen: false, product: null });
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, allAuctionsRes, ordersRes] = await Promise.all([
        api.get('/products/farmer/me'),
        api.get('/auctions/'),
        api.get('/orders/farmer/me')
      ]);
      
      const myProds = productsRes.data;
      setProducts(myProds);
      
      // Client-side filtering workaround since there's no GET /auctions/farmer/me endpoint
      const myProductIds = new Set(myProds.map(p => p.id));
      const myAucts = allAuctionsRes.data.filter(a => myProductIds.has(a.product_id));
      setAuctions(myAucts);
      
      setFarmerOrders(ordersRes.data);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Are you sure you want to remove this product?')) {
      try {
        await api.delete(`/products/${id}`);
        fetchData();
      } catch (err) {
        alert(err.response?.data?.detail || "Failed to delete product");
      }
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.target);
    const payload = {
      name: formData.get('name'),
      category: formData.get('category'),
      price: parseFloat(formData.get('price')),
      starting_price: parseFloat(formData.get('starting_price')),
      quantity: parseFloat(formData.get('quantity')),
      unit: formData.get('unit'),
      image_url: formData.get('image_url') || null
    };

    try {
      if (productModal.type === 'add') {
        await api.post('/products/', payload);
      } else {
        await api.put(`/products/${productModal.data.id}`, payload);
      }
      setProductModal({ isOpen: false, type: 'add', data: null });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save product");
    }
  };

  const handleAuctionSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.target);
    
    // Convert local datetime to UTC for backend
    const startLocal = new Date(formData.get('start_time'));
    const endLocal = new Date(formData.get('end_time'));
    
    const payload = {
      product_id: auctionModal.product.id,
      starting_price: parseFloat(formData.get('starting_price')),
      start_time: startLocal.toISOString().slice(0, 19), // YYYY-MM-DDTHH:mm:ss
      end_time: endLocal.toISOString().slice(0, 19)
    };

    try {
      await api.post('/auctions/', payload);
      setAuctionModal({ isOpen: false, product: null });
      fetchData();
    } catch (err) {
      let detail = err.response?.data?.detail;
      if (Array.isArray(detail)) detail = detail[0].msg;
      setError(typeof detail === 'string' ? detail : "Failed to start auction");
    }
  };

  // Derived Stats
  const activeProductsCount = products.filter(p => p.status === 'active').length;
  const liveAuctionsCount = auctions.filter(a => a.status === 'live').length;
  const upcomingAuctionsCount = auctions.filter(a => a.status === 'upcoming').length;

  const getStatusBadge = (status) => {
    let color = 'var(--color-muted)';
    if (status === 'active' || status === 'live' || status === 'success' || status === 'delivered') color = 'var(--color-success)';
    if (status === 'sold' || status === 'closed') color = 'var(--color-ink)';
    if (status === 'removed' || status === 'failed' || status === 'cancelled') color = 'var(--color-error)';
    if (status === 'upcoming' || status === 'pending') color = '#f39c12';
    if (status === 'confirmed') color = 'var(--color-primary)';
    
    return (
      <span style={{ 
        display: 'inline-block',
        padding: '2px 8px', 
        borderRadius: '12px', 
        fontSize: '0.75rem', 
        fontWeight: 'bold', 
        textTransform: 'capitalize',
        background: 'var(--color-white)',
        border: `1px solid ${color}`,
        color: color 
      }}>
        {status}
      </span>
    );
  };

  if (loading) return <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 8) 0', textAlign: 'center' }}>Loading dashboard...</div>;

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', background: '#f9fbfd' }}>
      
      {/* Sidebar Navigation */}
      <div style={{ width: '250px', background: 'var(--color-white)', borderRight: '1px solid var(--color-border)', padding: 'calc(var(--spacing-unit) * 3) 0' }}>
        <div style={{ padding: '0 calc(var(--spacing-unit) * 3)', marginBottom: 'calc(var(--spacing-unit) * 4)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Logged in as</div>
          <div style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>{user?.name}</div>
        </div>
        
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {['products', 'auctions', 'orders'].map(tab => (
            <li key={tab}>
              <button 
                onClick={() => setActiveTab(tab)}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: 'calc(var(--spacing-unit) * 1.5) calc(var(--spacing-unit) * 3)',
                  background: activeTab === tab ? 'var(--color-primary-light)' : 'transparent',
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-ink)',
                  borderLeft: activeTab === tab ? '3px solid var(--color-primary)' : '3px solid transparent',
                  fontWeight: activeTab === tab ? 'bold' : 'normal',
                  borderRadius: 0,
                  textTransform: 'capitalize'
                }}
              >
                {tab === 'products' ? 'My Products' : tab === 'auctions' ? 'My Auctions' : 'Orders'}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: 'calc(var(--spacing-unit) * 4)' }}>
        
        {/* Header Summary */}
        <div style={{ display: 'flex', gap: 'calc(var(--spacing-unit) * 3)', marginBottom: 'calc(var(--spacing-unit) * 4)' }}>
          <div style={{ background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Active Products</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{activeProductsCount}</div>
          </div>
          <div style={{ background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Live Auctions</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-success)' }}>{liveAuctionsCount}</div>
          </div>
          <div style={{ background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Upcoming Auctions</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>{upcomingAuctionsCount}</div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'products' && (
          <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3)', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>My Products</h2>
              <button className="btn-primary" onClick={() => setProductModal({ isOpen: true, type: 'add', data: null })}>
                Add Product
              </button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px' }}>Product</th>
                  <th style={{ padding: '12px 24px' }}>Category</th>
                  <th style={{ padding: '12px 24px' }}>Price / Unit</th>
                  <th style={{ padding: '12px 24px' }}>Qty</th>
                  <th style={{ padding: '12px 24px' }}>Status</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>No products listed yet.</td></tr>
                ) : products.map(p => {
                  const hasActiveAuction = auctions.some(a => a.product_id === p.id && (a.status === 'live' || a.status === 'upcoming'));
                  
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', background: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                          {p.image_url && <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <span style={{ fontWeight: '500' }}>{p.name}</span>
                      </td>
                      <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>{p.category}</td>
                      <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>Rs {parseFloat(p.price).toFixed(2)} / {p.unit}</td>
                      <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>{parseFloat(p.quantity)}</td>
                      <td style={{ padding: '12px 24px' }}>{getStatusBadge(p.status)}</td>
                      <td style={{ padding: '12px 24px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button style={{ color: 'var(--color-primary)', border: '1px solid var(--color-border)', background: 'var(--color-white)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }} onClick={() => setProductModal({ isOpen: true, type: 'edit', data: p })}>Edit</button>
                        <button style={{ color: 'var(--color-error)', border: '1px solid var(--color-border)', background: 'var(--color-white)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }} onClick={() => handleDeleteProduct(p.id)}>Remove</button>
                        {p.status === 'active' && !hasActiveAuction && (
                           <button style={{ color: 'var(--color-white)', background: 'var(--color-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }} onClick={() => setAuctionModal({ isOpen: true, product: p })}>Start Auction</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'auctions' && (
          <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ padding: 'calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3)', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>My Auctions</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px' }}>Product</th>
                  <th style={{ padding: '12px 24px' }}>Starting Price</th>
                  <th style={{ padding: '12px 24px' }}>Current Price</th>
                  <th style={{ padding: '12px 24px' }}>End Time</th>
                  <th style={{ padding: '12px 24px' }}>Status</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {auctions.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>No auctions created yet.</td></tr>
                ) : auctions.map(a => {
                  const product = products.find(p => p.id === a.product_id);
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 24px', fontWeight: '500' }}>{product?.name || `Product #${a.product_id}`}</td>
                      <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>Rs {parseFloat(a.starting_price).toFixed(2)}</td>
                      <td style={{ padding: '12px 24px', fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>Rs {parseFloat(a.current_price).toFixed(2)}</td>
                      <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>{new Date(a.end_time + 'Z').toLocaleString()}</td>
                      <td style={{ padding: '12px 24px' }}>{getStatusBadge(a.status)}</td>
                      <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                        <Link to={`/auction/${a.id}`}>
                          <button style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)', background: 'var(--color-primary-light)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>View Room</button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'orders' && (
          <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ padding: 'calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3)', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Orders</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px' }}>Date</th>
                  <th style={{ padding: '12px 24px' }}>Buyer</th>
                  <th style={{ padding: '12px 24px' }}>Product</th>
                  <th style={{ padding: '12px 24px' }}>Qty</th>
                  <th style={{ padding: '12px 24px' }}>Total Amount</th>
                  <th style={{ padding: '12px 24px' }}>Payment</th>
                  <th style={{ padding: '12px 24px' }}>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {farmerOrders.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>No orders found for your products.</td></tr>
                ) : farmerOrders.map(order => {
                  let product = null;
                  let qty = '-';
                  
                  if (order.product_id) {
                    product = products.find(p => p.id === order.product_id);
                    if (product && parseFloat(product.price) > 0) {
                      qty = (parseFloat(order.total_amount) / parseFloat(product.price)).toFixed(2).replace(/\.00$/, '');
                    }
                  } else if (order.auction_id) {
                    const auction = auctions.find(a => a.id === order.auction_id);
                    if (auction) {
                      product = products.find(p => p.id === auction.product_id);
                    }
                    qty = '1 (Lot)';
                  }
                  
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>
                        {new Date(order.created_at + 'Z').toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 24px' }}>
                        <div style={{ fontWeight: '500', color: 'var(--color-ink)' }}>{order.buyer_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{order.buyer_email}</div>
                      </td>
                      <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>
                        {product ? product.name : 'Unknown Product'}
                      </td>
                      <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>{qty}</td>
                      <td style={{ padding: '12px 24px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                        Rs {parseFloat(order.total_amount).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 24px' }}>
                        {order.payment_status ? getStatusBadge(order.payment_status) : <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Unpaid</span>}
                      </td>
                      <td style={{ padding: '12px 24px' }}>
                        {order.delivery_status ? getStatusBadge(order.delivery_status) : <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Not Assigned</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {productModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(26, 31, 41, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 4)', borderRadius: 'var(--radius)', width: '100%', maxWidth: '500px' }}>
            <h2 style={{ marginTop: 0 }}>{productModal.type === 'add' ? 'Add New Product' : 'Edit Product'}</h2>
            {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
            
            <form onSubmit={handleProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--spacing-unit) * 2)' }}>
              <div>
                <label>Name</label>
                <input type="text" name="name" defaultValue={productModal.data?.name} required />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label>Category</label>
                  <select name="category" defaultValue={productModal.data?.category || 'vegetables'} required>
                    <option value="vegetables">Vegetables</option>
                    <option value="fruits">Fruits</option>
                    <option value="herbs">Herbs</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Unit (e.g. kg, dozen)</label>
                  <input type="text" name="unit" defaultValue={productModal.data?.unit || 'kg'} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label>Buy Now Price (Rs)</label>
                  <input type="number" step="0.01" name="price" defaultValue={productModal.data?.price} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Auction Start Price (Rs)</label>
                  <input type="number" step="0.01" name="starting_price" defaultValue={productModal.data?.starting_price || 0.0} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label>Initial Quantity</label>
                  <input type="number" step="0.01" name="quantity" defaultValue={productModal.data?.quantity} required />
                </div>
              </div>
              <div>
                <label>Image URL (optional)</label>
                <input type="url" name="image_url" defaultValue={productModal.data?.image_url} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setProductModal({ isOpen: false })}>Cancel</button>
                <button type="submit" className="btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auction Modal */}
      {auctionModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(26, 31, 41, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 4)', borderRadius: 'var(--radius)', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0 }}>Start Auction</h2>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>For: {auctionModal.product.name}</p>
            {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
            
            <form onSubmit={handleAuctionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--spacing-unit) * 2)' }}>
              <div>
                <label>Starting Price (Rs)</label>
                <input type="number" step="0.01" name="starting_price" defaultValue={auctionModal.product.starting_price} required />
              </div>
              <div>
                <label>Start Time (Local)</label>
                <input type="datetime-local" name="start_time" required />
              </div>
              <div>
                <label>End Time (Local)</label>
                <input type="datetime-local" name="end_time" required />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setAuctionModal({ isOpen: false })}>Cancel</button>
                <button type="submit" className="btn-primary">Create Auction</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FarmerDashboard;
