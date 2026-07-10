import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        // Fastapi validation errors or explicit 401
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail[0].msg);
        } else {
          setError('Login failed. Please check your credentials.');
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
      backgroundColor: '#f9fbfd' // slight off-white for contrast against the white card
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
          Login
        </h2>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--spacing-unit) * 2.5)', marginTop: error ? 'calc(var(--spacing-unit) * 2)' : 0 }}>
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
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: 'calc(var(--spacing-unit) * 1)', opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div style={{ marginTop: 'calc(var(--spacing-unit) * 3)', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-muted)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: '500' }}>Register</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
