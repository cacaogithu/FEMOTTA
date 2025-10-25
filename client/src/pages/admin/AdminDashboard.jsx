import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

function AdminDashboard() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      const response = await fetch('/api/brand/list');
      if (!response.ok) {
        throw new Error('Failed to load brands');
      }
      const data = await response.json();
      setBrands(data.brands || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const handleEdit = (brandId) => {
    navigate(`/admin/brands/${brandId}/edit`);
  };

  const handleCreate = () => {
    navigate('/admin/brands/new');
  };

  if (loading) {
    return (
      <div className="admin-dashboard loading">
        <div className="loading-spinner">Loading brands...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Brand Management</h1>
        <div className="admin-actions">
          <button onClick={handleCreate} className="btn-create">
            + Create New Brand
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="brands-table-container">
        <table className="brands-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Slug</th>
              <th>Display Name</th>
              <th>Primary Color</th>
              <th>Secondary Color</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.id}>
                <td>{brand.id}</td>
                <td>{brand.name}</td>
                <td>{brand.slug}</td>
                <td>{brand.displayName}</td>
                <td>
                  <div className="color-preview">
                    <span
                      className="color-swatch"
                      style={{ backgroundColor: brand.primaryColor }}
                    ></span>
                    {brand.primaryColor}
                  </div>
                </td>
                <td>
                  <div className="color-preview">
                    <span
                      className="color-swatch"
                      style={{ backgroundColor: brand.secondaryColor }}
                    ></span>
                    {brand.secondaryColor}
                  </div>
                </td>
                <td>
                  <button
                    onClick={() => handleEdit(brand.id)}
                    className="btn-edit"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {brands.length === 0 && (
          <div className="no-brands">
            <p>No brands found. Create your first brand to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
