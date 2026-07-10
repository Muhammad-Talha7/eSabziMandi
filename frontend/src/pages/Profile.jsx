import React from 'react';
import useAuth from '../hooks/useAuth';

const Profile = () => {
  const { user, role, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 4) calc(var(--spacing-unit) * 2)', maxWidth: '600px' }}>
      <h1 style={{ marginTop: 0, color: 'var(--color-ink)' }}>My Profile</h1>
      
      <div style={{ 
        background: 'var(--color-white)', 
        border: '1px solid var(--color-border)', 
        borderRadius: 'var(--radius)',
        padding: 'calc(var(--spacing-unit) * 4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'calc(var(--spacing-unit) * 3)'
      }}>
        
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
          <div style={{ fontSize: '1.125rem', color: 'var(--color-ink)', fontWeight: '500' }}>{user.name}</div>
        </div>
        
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
          <div style={{ fontSize: '1.125rem', color: 'var(--color-ink)', fontWeight: '500' }}>{user.email}</div>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</label>
          <div style={{ fontSize: '1.125rem', color: 'var(--color-ink)', fontWeight: '500' }}>{user.phone || 'Not provided'}</div>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Role</label>
          <div style={{ 
            display: 'inline-block',
            marginTop: 'calc(var(--spacing-unit) * 0.5)',
            background: 'var(--color-primary-light)', 
            color: 'var(--color-primary)', 
            padding: '4px 8px', 
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            fontWeight: 'bold',
            textTransform: 'capitalize'
          }}>
            {role}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
          <div style={{ 
            display: 'inline-block',
            marginTop: 'calc(var(--spacing-unit) * 0.5)',
            color: user.verified ? 'var(--color-success)' : 'var(--color-error)',
            fontWeight: '500'
          }}>
            {user.verified ? 'Verified Account' : 'Unverified Account'}
          </div>
        </div>

        <div style={{ 
          borderTop: '1px solid var(--color-border)', 
          marginTop: 'calc(var(--spacing-unit) * 2)', 
          paddingTop: 'calc(var(--spacing-unit) * 3)' 
        }}>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', fontStyle: 'italic', marginBottom: 'calc(var(--spacing-unit) * 2)' }}>
            Note: Profile editing is not yet available in this version.
          </p>
          <button className="btn-secondary" onClick={logout}>Log out of account</button>
        </div>
        
      </div>
    </div>
  );
};

export default Profile;
