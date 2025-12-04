import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useAuth() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('userToken');
      const userInfo = localStorage.getItem('userInfo');

      if (token && userInfo) {
        const response = await fetch('/api/users/verify', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(JSON.parse(userInfo));
          setIsAuthenticated(true);
          return true;
        } else {
          localStorage.removeItem('userToken');
          localStorage.removeItem('userInfo');
        }
      }

      const authResponse = await fetch('/api/auth/user', {
        credentials: 'include'
      });

      if (authResponse.ok) {
        const userData = await authResponse.json();
        setUser(userData);
        setIsAuthenticated(true);
        return true;
      }

      setUser(null);
      setIsAuthenticated(false);
      return false;
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email, password) => {
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('userToken', data.token);
    localStorage.setItem('userInfo', JSON.stringify(data.user));
    setUser(data.user);
    setIsAuthenticated(true);
    return data;
  }, []);

  const register = useCallback(async (userData) => {
    const response = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('userToken', data.token);
    localStorage.setItem('userInfo', JSON.stringify(data.user));
    setUser(data.user);
    setIsAuthenticated(true);
    return data;
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userInfo');
    setUser(null);
    setIsAuthenticated(false);

    try {
      await fetch('/api/logout', { credentials: 'include' });
    } catch (error) {
    }

    navigate('/login');
  }, [navigate]);

  const loginWithReplit = useCallback(() => {
    window.location.href = '/api/login';
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    loginWithReplit,
    checkAuth,
  };
}

export default useAuth;
