import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      if (token) {
        try {
          const decoded = jwtDecode(token);
          // Check for token expiration (exp is in seconds, Date.now() is ms)
          if (decoded.exp * 1000 < Date.now()) {
            throw new Error("Token expired");
          }

          if (decoded.role) {
            setRole(decoded.role);
          }
          
          // Verify token still valid on backend and fetch full user profile
          const res = await api.get('/auth/me');
          setUser(res.data);
          
          if (!decoded.role && res.data.role) {
             setRole(res.data.role);
          }
        } catch (err) {
          console.error("Auth error", err);
          logout(); // silently logout if fails
        }
      }
      setLoading(false);
    };
    
    initializeAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const newToken = res.data.access_token;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    
    const decoded = jwtDecode(newToken);
    if (decoded.role) setRole(decoded.role);
    
    // In our api/axios.js, interceptor automatically attaches the new token from localStorage
    const userRes = await api.get('/auth/me');
    setUser(userRes.data);
    
    if (!decoded.role && userRes.data.role) setRole(userRes.data.role);
  };

  const register = async (userData) => {
    await api.post('/auth/register', userData);
    await login(userData.email, userData.password);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, role, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};
