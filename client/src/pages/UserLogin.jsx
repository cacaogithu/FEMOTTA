import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './UserLogin.css';

function UserLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    checkTestMode();
  }, []);

  const checkTestMode = async () => {
    try {
      const response = await fetch('/api/users/test-mode');
      const data = await response.json();
      
      if (data.testMode) {
        setTestMode(true);
        await handleTestLogin();
      }
    } catch (error) {
      console.log('Test mode check failed, using normal login');
    }
  };

  const handleTestLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/test-login', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Test login failed');
      }

      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userInfo', JSON.stringify(data.user));

      navigate('/editor');
    } catch (err) {
      setError(err.message);
      setTestMode(false);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userInfo', JSON.stringify(data.user));

      navigate('/editor');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (testMode && loading) {
    return (
      <div className="user-login">
        <div className="user-login-container">
          <div className="user-login-header">
            <img 
              src="/corsair-logo.jpg" 
              alt="Corsair Logo" 
              className="corsair-logo"
            />
            <h1>CORSAIR Login</h1>
            <p className="subtitle">AI Image Editing Platform</p>
          </div>
          <div style={{ 
            padding: '30px', 
            textAlign: 'center', 
            background: 'rgba(255, 193, 7, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 193, 7, 0.3)'
          }}>
            <div style={{ color: '#FFC107', fontSize: '16px', marginBottom: '10px' }}>
              🧪 TEST MODE ACTIVE
            </div>
            <div style={{ color: '#ccc', fontSize: '14px' }}>
              Auto-logging in for testing...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-login">
      <div className="user-login-container">
        <div className="user-login-header">
          <img 
            src="/corsair-logo.jpg" 
            alt="Corsair Logo" 
            className="corsair-logo"
          />
          <h1>CORSAIR Login</h1>
          <p className="subtitle">AI Image Editing Platform</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              autoComplete="email"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-login">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default UserLogin;
