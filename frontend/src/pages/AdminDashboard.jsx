import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  
  const [products, setProducts] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assignment states
  const [assigningOrder, setAssigningOrder] = useState(null);
  const [selectedRider, setSelectedRider] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, auctionsRes, statsRes, ordersRes, usersRes, ridersRes] = await Promise.all([
        api.get('/products/?limit=100'),
        api.get('/auctions/'),
        api.get('/admin/stats'),
        api.get('/admin/orders?limit=100'),
        api.get('/admin/users?limit=100'),
        api.get('/admin/users?role=rider&limit=100')
      ]);
      setProducts(productsRes.data);
      setAuctions(auctionsRes.data);
      setStats(statsRes.data);
      setOrders(ordersRes.data);
      setUsers(usersRes.data);
      setRiders(ridersRes.data);
    } catch (err) {
      console.error("Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Are you sure you want to completely remove this product? This is an admin override.')) {
      try {
        await api.delete(`/admin/products/${id}`);
        fetchData();
      } catch (err) {
        alert(err.response?.data?.detail || "Failed to remove product");
      }
    }
  };

  const handleVerifyToggle = async (userId, currentVerifiedStatus) => {
    try {
      await api.patch(`/admin/users/${userId}/verify`, { verified: !currentVerifiedStatus });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update verification status");
    }
  };

  const handleAssignRider = async (orderId) => {
    if (!selectedRider) return alert('Please select a rider first');
    try {
      await api.post(`/deliveries/?order_id=${orderId}`, { rider_id: parseInt(selectedRider) });
      setAssigningOrder(null);
      setSelectedRider('');
      fetchData(); // Refresh to show new delivery status
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to assign rider");
    }
  };

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
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--color-error)' }}>Admin Panel</div>
          <div style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>{user?.name}</div>
        </div>
        
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {['overview', 'users', 'orders', 'products', 'auctions'].map(tab => (
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
                {tab === 'overview' ? 'Overview' : tab === 'users' ? 'Users & Verification' : tab === 'orders' ? 'All Orders' : tab === 'products' ? 'All Products' : 'All Auctions'}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: 'calc(var(--spacing-unit) * 4)', maxWidth: '1200px' }}>
        
        {/* Tab Content */}
        {activeTab === 'overview' && stats && (
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 'calc(var(--spacing-unit) * 3)' }}>Platform Overview</h2>
            <div style={{ display: 'flex', gap: 'calc(var(--spacing-unit) * 3)', flexWrap: 'wrap', marginBottom: 'calc(var(--spacing-unit) * 4)' }}>
              
              <div style={{ background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', flex: '1 1 200px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Total Revenue</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-success)' }}>Rs {stats.total_revenue.toFixed(2)}</div>
              </div>
              
              <div style={{ background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', flex: '1 1 200px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Registered Users</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                  {Object.values(stats.total_users).reduce((a,b) => a+b, 0)}
                </div>
              </div>
              
              <div style={{ background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', flex: '1 1 200px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Total Orders</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-ink)' }}>
                  {Object.values(stats.total_orders).reduce((a,b) => a+b, 0)}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 'calc(var(--spacing-unit) * 3)' }}>
              <div style={{ flex: 1, background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                <h3 style={{ marginTop: 0, fontSize: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>User Breakdown</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {Object.entries(stats.total_users).map(([role, count]) => (
                    <li key={role} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ textTransform: 'capitalize' }}>{role}s</span>
                      <span style={{ fontWeight: 'bold' }}>{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div style={{ flex: 1, background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                <h3 style={{ marginTop: 0, fontSize: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Product Breakdown</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {Object.entries(stats.total_products).map(([status, count]) => (
                    <li key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ textTransform: 'capitalize' }}>{status}</span>
                      <span style={{ fontWeight: 'bold' }}>{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div style={{ flex: 1, background: 'var(--color-white)', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                <h3 style={{ marginTop: 0, fontSize: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Order Breakdown</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {Object.entries(stats.total_orders).map(([status, count]) => (
                    <li key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ textTransform: 'capitalize' }}>{status}</span>
                      <span style={{ fontWeight: 'bold' }}>{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3)', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Users & Verification</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px' }}>ID</th>
                  <th style={{ padding: '12px 24px' }}>Name / Email</th>
                  <th style={{ padding: '12px 24px' }}>Role</th>
                  <th style={{ padding: '12px 24px' }}>Verification</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 24px', fontWeight: 'bold' }}>#{u.id}</td>
                    <td style={{ padding: '12px 24px' }}>
                      <div style={{ fontWeight: '500', color: 'var(--color-ink)' }}>{u.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '12px 24px', textTransform: 'capitalize' }}>{u.role}</td>
                    <td style={{ padding: '12px 24px' }}>
                      {u.verified ? (
                        <span style={{ color: 'var(--color-success)', fontWeight: 'bold', fontSize: '0.875rem' }}>✓ Verified</span>
                      ) : (
                        <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Unverified</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                      {(u.role === 'farmer' || u.role === 'rider') && (
                        <button 
                          onClick={() => handleVerifyToggle(u.id, u.verified)}
                          style={{ 
                            background: u.verified ? 'var(--color-white)' : 'var(--color-primary)', 
                            color: u.verified ? 'var(--color-error)' : 'var(--color-white)', 
                            border: u.verified ? '1px solid var(--color-error)' : 'none', 
                            padding: '6px 12px', 
                            borderRadius: '4px', 
                            cursor: 'pointer', 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold' 
                          }}
                        >
                          {u.verified ? 'Revoke Verification' : 'Verify Account'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'orders' && (
          <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3)', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>All Platform Orders</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px' }}>Order #</th>
                  <th style={{ padding: '12px 24px' }}>Buyer</th>
                  <th style={{ padding: '12px 24px' }}>Source</th>
                  <th style={{ padding: '12px 24px' }}>Total Amount</th>
                  <th style={{ padding: '12px 24px' }}>Payment</th>
                  <th style={{ padding: '12px 24px' }}>Delivery</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>No orders found.</td></tr>
                ) : orders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 24px', fontWeight: 'bold' }}>#{order.id}</td>
                    <td style={{ padding: '12px 24px' }}>
                      <div style={{ fontWeight: '500', color: 'var(--color-ink)' }}>{order.buyer_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{order.buyer_email}</div>
                    </td>
                    <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>
                      {order.auction_id ? `Auction #${order.auction_id}` : `Direct #${order.product_id}`}
                    </td>
                    <td style={{ padding: '12px 24px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      Rs {parseFloat(order.total_amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 24px' }}>
                      {order.payment_status ? getStatusBadge(order.payment_status) : <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Unpaid</span>}
                    </td>
                    <td style={{ padding: '12px 24px' }}>
                      {order.delivery_status ? getStatusBadge(order.delivery_status) : <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Not Assigned</span>}
                    </td>
                    <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                      {order.status === 'confirmed' && !order.delivery_status ? (
                        assigningOrder === order.id ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <select 
                              value={selectedRider} 
                              onChange={(e) => setSelectedRider(e.target.value)}
                              style={{ padding: '4px', fontSize: '0.75rem' }}
                            >
                              <option value="">Select Rider...</option>
                              {riders.map(r => (
                                <option key={r.id} value={r.id}>#{r.id} - {r.name} ({r.verified ? 'Verified' : 'Unverified'})</option>
                              ))}
                            </select>
                            <button className="btn-primary" onClick={() => handleAssignRider(order.id)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Assign</button>
                            <button className="btn-secondary" onClick={() => setAssigningOrder(null)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Cancel</button>
                          </div>
                        ) : (
                          <button className="btn-primary" onClick={() => setAssigningOrder(order.id)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                            Assign Rider
                          </button>
                        )
                      ) : (
                        <span style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'products' && (
          <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3)', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>All Products</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px' }}>ID</th>
                  <th style={{ padding: '12px 24px' }}>Farmer ID</th>
                  <th style={{ padding: '12px 24px' }}>Product</th>
                  <th style={{ padding: '12px 24px' }}>Price / Unit</th>
                  <th style={{ padding: '12px 24px' }}>Qty</th>
                  <th style={{ padding: '12px 24px' }}>Status</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>No products found.</td></tr>
                ) : products.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 24px', fontWeight: 'bold' }}>#{p.id}</td>
                    <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>Farmer {p.farmer_id}</td>
                    <td style={{ padding: '12px 24px', fontWeight: '500' }}>{p.name}</td>
                    <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>Rs {parseFloat(p.price).toFixed(2)} / {p.unit}</td>
                    <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>{parseFloat(p.quantity)}</td>
                    <td style={{ padding: '12px 24px' }}>{getStatusBadge(p.status)}</td>
                    <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                      {p.status !== 'removed' && (
                        <button 
                          onClick={() => handleDeleteProduct(p.id)}
                          style={{ color: 'var(--color-error)', background: 'var(--color-white)', border: '1px solid var(--color-error)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'auctions' && (
          <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ padding: 'calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3)', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>All Auctions</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px' }}>ID</th>
                  <th style={{ padding: '12px 24px' }}>Product ID</th>
                  <th style={{ padding: '12px 24px' }}>Current Price</th>
                  <th style={{ padding: '12px 24px' }}>End Time</th>
                  <th style={{ padding: '12px 24px' }}>Status</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {auctions.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>No auctions found.</td></tr>
                ) : auctions.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 24px', fontWeight: 'bold' }}>#{a.id}</td>
                    <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>Product {a.product_id}</td>
                    <td style={{ padding: '12px 24px', fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>Rs {parseFloat(a.current_price).toFixed(2)}</td>
                    <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>{new Date(a.end_time + 'Z').toLocaleString()}</td>
                    <td style={{ padding: '12px 24px' }}>{getStatusBadge(a.status)}</td>
                    <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                      <Link to={`/auction/${a.id}`} style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}>
                        Spectate Room
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
