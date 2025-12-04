import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

function UserProtectedRoute({ children }) {
  const [isValid, setIsValid] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndTestMode();
  }, []);

  const checkAuthAndTestMode = async () => {
    try {
      const testModeResponse = await fetch('/api/users/test-mode');
      const testModeData = await testModeResponse.json();
      
      if (testModeData.testMode) {
        const existingToken = localStorage.getItem('userToken');
        
        if (!existingToken) {
          const loginResponse = await fetch('/api/users/test-login', {
            method: 'POST',
          });
          const loginData = await loginResponse.json();
          
          if (loginResponse.ok) {
            localStorage.setItem('userToken', loginData.token);
            localStorage.setItem('userInfo', JSON.stringify(loginData.user));
            setIsValid(true);
            setLoading(false);
            return;
          }
        }
      }
    } catch (error) {
      console.log('Test mode check failed, using normal auth');
    }
    
    verifyToken();
  };

  const verifyToken = async () => {
    const userToken = localStorage.getItem('userToken');

    if (!userToken) {
      setIsValid(false);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/users/verify', {
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      if (response.ok) {
        setIsValid(true);
      } else {
        const data = await response.json();
        if (data.expired) {
          console.log('Token expired, clearing session');
        }
        localStorage.removeItem('userToken');
        localStorage.removeItem('userInfo');
        setIsValid(false);
      }
    } catch (error) {
      console.error('Token verification error:', error);
      localStorage.removeItem('userToken');
      localStorage.removeItem('userInfo');
      setIsValid(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFC107',
        fontSize: '18px',
        fontWeight: '500'
      }}>
        <div style={{
          textAlign: 'center',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>
          Verifying authentication...
        </div>
      </div>
    );
  }

  if (!isValid) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default UserProtectedRoute;
