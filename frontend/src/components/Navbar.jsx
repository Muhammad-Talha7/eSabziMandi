import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const { token, role, logout } = useAuth();
  const { cartItems } = useCart();
  const navigate = useNavigate();

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkStyle = ({ isActive }) => ({
    padding: 'calc(var(--spacing-unit) * 2) 0',
    color: 'var(--color-ink)',
    borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
    fontWeight: isActive ? '600' : '400',
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    boxSizing: 'border-box'
  });

  return (
    <nav style={{ 
      background: 'var(--color-white)', 
      borderBottom: '1px solid var(--color-border)',
      padding: '0 calc(var(--spacing-unit) * 3)',
      display: 'flex', 
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '64px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--spacing-unit) * 4)', height: '100%' }}>
        <Link to="/" style={{ 
          color: 'var(--color-primary)', 
          fontWeight: 'bold', 
          fontSize: '1.25rem',
          letterSpacing: '-0.02em'
        }}>
          Smart Vegetable Market
        </Link>
        <div style={{ display: 'flex', gap: 'calc(var(--spacing-unit) * 3)', height: '100%' }}>
          {token && <NavLink to="/products" style={navLinkStyle}>Products</NavLink>}
          {token && role === 'buyer' && (
            <>
              <NavLink to="/cart" style={navLinkStyle}>
                Cart 
                {cartCount > 0 && (
                  <span style={{ 
                    background: 'var(--color-primary)', 
                    color: 'var(--color-white)', 
                    borderRadius: '12px', 
                    padding: '2px 6px', 
                    fontSize: '0.75rem', 
                    marginLeft: '8px',
                    fontWeight: 'bold'
                  }}>{cartCount}</span>
                )}
              </NavLink>
              <NavLink to="/orders" style={navLinkStyle}>My Orders</NavLink>
            </>
          )}
          {token && role === 'farmer' && (
            <NavLink to="/farmer/dashboard" style={navLinkStyle}>Dashboard</NavLink>
          )}
          {token && role === 'rider' && (
            <NavLink to="/rider/dashboard" style={navLinkStyle}>Deliveries</NavLink>
          )}
          {token && role === 'admin' && (
            <NavLink to="/admin/dashboard" style={navLinkStyle}>Admin</NavLink>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--spacing-unit) * 3)' }}>
        {token ? (
          <>
            <Link to="/profile" style={{ color: 'var(--color-ink)', fontWeight: '500' }}>Profile</Link>
            <button className="btn-secondary" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ color: 'var(--color-ink)', fontWeight: '500' }}>Login</Link>
            <Link to="/register"><button className="btn-primary">Register</button></Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
