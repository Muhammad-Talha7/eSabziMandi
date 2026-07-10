import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';

const RiderDashboard = () => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, assigned, picked_up, delivered
  const [actionError, setActionError] = useState({ id: null, msg: '' });

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/deliveries/rider/me');
      setDeliveries(res.data);
    } catch (err) {
      console.error("Failed to load deliveries", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleStatusUpdate = async (id, newStatus) => {
    setActionError({ id: null, msg: '' });
    try {
      const res = await api.patch(`/deliveries/${id}/status`, { status: newStatus });
      // Update item in place
      setDeliveries(prev => prev.map(d => d.id === id ? res.data : d));
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Update failed";
      setActionError({ id, msg: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg) });
    }
  };

  const filteredDeliveries = deliveries.filter(d => filter === 'all' || d.status === filter);

  const getStatusBadge = (status) => {
    let color = 'var(--color-muted)';
    if (status === 'assigned') color = '#f39c12'; // Amber
    if (status === 'picked_up') color = 'var(--color-primary)'; // Blue
    if (status === 'delivered') color = 'var(--color-success)'; // Green
    
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
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)', background: '#f9fbfd' }}>
      
      {/* Header */}
      <div style={{ background: 'var(--color-white)', borderBottom: '1px solid var(--color-border)', padding: 'calc(var(--spacing-unit) * 3) calc(var(--spacing-unit) * 4)' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'var(--color-ink)' }}>Rider Dashboard</h1>
        <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Logged in as {user?.name}</div>
      </div>

      <div style={{ padding: 'calc(var(--spacing-unit) * 4)', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: 'calc(var(--spacing-unit) * 3)' }}>
          {['all', 'assigned', 'picked_up', 'delivered'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius)',
                border: filter === f ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: filter === f ? 'var(--color-primary-light)' : 'var(--color-white)',
                color: filter === f ? 'var(--color-primary)' : 'var(--color-ink)',
                fontWeight: filter === f ? 'bold' : 'normal',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Missing Backend Data Warning */}
        <div style={{ 
          background: 'var(--color-primary-light)', 
          borderLeft: '4px solid var(--color-primary)', 
          padding: 'calc(var(--spacing-unit) * 2)', 
          marginBottom: 'calc(var(--spacing-unit) * 3)',
          fontSize: '0.875rem',
          color: 'var(--color-primary-dark)',
          borderRadius: '0 var(--radius) var(--radius) 0'
        }}>
          <strong>Note on Data Gaps:</strong> The current backend <code>GET /deliveries/rider/me</code> and <code>DeliveryOut</code> schemas do not include buyer contact information or product pickup context. Additionally, riders do not have permission to call <code>GET /orders/:id</code> to fetch this manually. This data is marked as "N/A" below until a backend endpoint is updated to return it.
        </div>

        {/* Deliveries List */}
        <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-primary-light)', color: 'var(--color-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 24px' }}>Order #</th>
                <th style={{ padding: '12px 24px' }}>Status</th>
                <th style={{ padding: '12px 24px' }}>Buyer Context</th>
                <th style={{ padding: '12px 24px' }}>Pickup Context</th>
                <th style={{ padding: '12px 24px' }}>Timeline</th>
                <th style={{ padding: '12px 24px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>Loading deliveries...</td></tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>No deliveries found for this status.</td></tr>
              ) : filteredDeliveries.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 24px', fontWeight: 'bold' }}>#{d.order_id}</td>
                  <td style={{ padding: '12px 24px' }}>{getStatusBadge(d.status)}</td>
                  <td style={{ padding: '12px 24px', color: 'var(--color-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>[N/A - See Note]</td>
                  <td style={{ padding: '12px 24px', color: 'var(--color-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>[N/A - See Note]</td>
                  <td style={{ padding: '12px 24px', fontSize: '0.875rem' }}>
                    {d.delivered_at ? (
                       <span style={{ color: 'var(--color-success)', fontWeight: '500' }}>Delivered: {new Date(d.delivered_at + 'Z').toLocaleString()}</span>
                    ) : d.picked_at ? (
                       <span style={{ color: 'var(--color-primary)' }}>Picked up: {new Date(d.picked_at + 'Z').toLocaleString()}</span>
                    ) : (
                       <span style={{ color: 'var(--color-muted)' }}>Assigned: Pending Pickup</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                    {d.status === 'assigned' && (
                      <button className="btn-primary" onClick={() => handleStatusUpdate(d.id, 'picked_up')} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                        Mark Picked Up
                      </button>
                    )}
                    {d.status === 'picked_up' && (
                      <button className="btn-primary" onClick={() => handleStatusUpdate(d.id, 'delivered')} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                        Mark Delivered
                      </button>
                    )}
                    
                    {actionError.id === d.id && (
                      <div style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginTop: '4px', textAlign: 'right' }}>
                        {actionError.msg}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
      </div>
    </div>
  );
};

export default RiderDashboard;
