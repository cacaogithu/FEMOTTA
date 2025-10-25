import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './BrandLogin.css';

function BrandLogin() {
  const { brandSlug } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/brand/${brandSlug}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store the brand token
      localStorage.setItem('brandToken', data.token);
      localStorage.setItem('brandInfo', JSON.stringify(data.brand));

      // Apply brand theming
      document.documentElement.style.setProperty('--brand-primary', data.brand.primaryColor);
      document.documentElement.style.setProperty('--brand-secondary', data.brand.secondaryColor);

      // Redirect to main app
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = () => {
    navigate('/admin/login');
  };

  return (
    <div className="brand-login">
      <div className="brand-login-container">
        <div className="brand-login-header">
          <h1>{brandSlug.replace(/-/g, ' ').toUpperCase()} Login</h1>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Brand Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter brand password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-login">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="brand-login-footer">
          <button onClick={handleAdminLogin} className="btn-link">
            ← Admin Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default BrandLogin;
