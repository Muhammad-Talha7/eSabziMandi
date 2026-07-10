import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await register({ name, email, password, role });
      navigate('/login');
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail[0].msg);
        } else {
          setError('Registration failed. Please try again.');
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: 'calc(100vh - 64px)',
      padding: 'calc(var(--spacing-unit) * 4)',
      backgroundColor: '#f9fbfd'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--color-white)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'calc(var(--spacing-unit) * 4)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 'calc(var(--spacing-unit) * 3)', color: 'var(--color-ink)', fontWeight: '600' }}>
          Register
        </h2>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--spacing-unit) * 2.5)', marginTop: error ? 'calc(var(--spacing-unit) * 2)' : 0 }}>
          <div>
            <label htmlFor="name">Full Name</label>
            <input 
              type="text" 
              id="name" 
              placeholder="John Doe" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email" 
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="role">Account Type</label>
            <select 
              id="role" 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="buyer">Buyer</option>
              <option value="farmer">Farmer</option>
              <option value="rider">Rider</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: 'calc(var(--spacing-unit) * 1)', opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <div style={{ marginTop: 'calc(var(--spacing-unit) * 3)', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: '500' }}>Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
