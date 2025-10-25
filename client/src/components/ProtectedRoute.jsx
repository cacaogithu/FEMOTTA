import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const [isValid, setIsValid] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyToken();
  }, []);

  const verifyToken = async () => {
    const adminToken = localStorage.getItem('adminToken');

    if (!adminToken) {
      setIsValid(false);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/verify', {
        headers: {
          'X-Admin-Key': adminToken,
        },
      });

      if (response.ok) {
        setIsValid(true);
      } else {
        const data = await response.json();
        if (data.expired) {
          console.log('Token expired, clearing session');
        }
        localStorage.removeItem('adminToken');
        setIsValid(false);
      }
    } catch (error) {
      console.error('Token verification error:', error);
      localStorage.removeItem('adminToken');
      setIsValid(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffd700',
        fontSize: '18px'
      }}>
        Verifying access...
      </div>
    );
  }

  if (!isValid) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
