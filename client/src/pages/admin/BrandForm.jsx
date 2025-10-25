import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './BrandForm.css';

function BrandForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    displayName: '',
    primaryColor: '#ffd700',
    secondaryColor: '#ffed4e',
    logoUrl: '',
    googleDriveBriefFolderId: '',
    googleDriveProductImagesFolderId: '',
    googleDriveEditedResultsFolderId: '',
    wavespeedApiKey: '',
    openaiApiKey: '',
    defaultPrompt: '',
    batchSize: 15,
    estimatedManualTimePerImageMinutes: 5,
  });

  useEffect(() => {
    if (isEditing) {
      loadBrand();
    }
  }, [id]);

  const loadBrand = async () => {
    try {
      // Fetch all brands and find the one with matching ID
      const response = await fetch('/api/brand/list');
      if (!response.ok) {
        throw new Error('Failed to load brands');
      }
      const result = await response.json();
      const data = result.brands.find(b => b.id === parseInt(id));
      
      if (!data) {
        throw new Error('Brand not found');
      }
      
      // Note: API keys are not loaded for security - only allow setting new ones
      setFormData({
        name: data.name || '',
        slug: data.slug || '',
        displayName: data.displayName || '',
        primaryColor: data.primaryColor || '#ffd700',
        secondaryColor: data.secondaryColor || '#ffed4e',
        logoUrl: data.logoUrl || '',
        googleDriveBriefFolderId: data.googleDriveBriefFolderId || '',
        googleDriveProductImagesFolderId: data.googleDriveProductImagesFolderId || '',
        googleDriveEditedResultsFolderId: data.googleDriveEditedResultsFolderId || '',
        wavespeedApiKey: '', // Never display existing keys for security
        openaiApiKey: '', // Never display existing keys for security
        defaultPrompt: data.defaultPrompt || '',
        batchSize: data.batchSize || 15,
        estimatedManualTimePerImageMinutes: data.estimatedManualTimePerImageMinutes || 5,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        throw new Error('Not authenticated');
      }

      const url = isEditing
        ? `/api/brand/admin/${id}`
        : '/api/brand/admin/create';
      
      const method = isEditing ? 'PUT' : 'POST';

      // When editing, only send API keys if they've been changed (non-empty)
      const payload = { ...formData };
      if (isEditing) {
        if (!payload.wavespeedApiKey) delete payload.wavespeedApiKey;
        if (!payload.openaiApiKey) delete payload.openaiApiKey;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save brand');
      }

      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="brand-form loading">
        <div className="loading-spinner">Loading brand...</div>
      </div>
    );
  }

  return (
    <div className="brand-form">
      <div className="form-container">
        <div className="form-header">
          <h1>{isEditing ? 'Edit Brand' : 'Create New Brand'}</h1>
          <button onClick={handleCancel} className="btn-close">
            ✕
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>Basic Information</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., CORSAIR"
                />
              </div>
              <div className="form-group">
                <label htmlFor="slug">Slug *</label>
                <input
                  type="text"
                  id="slug"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  required
                  placeholder="e.g., corsair"
                  pattern="[a-z0-9-]+"
                  title="Lowercase letters, numbers, and hyphens only"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="displayName">Display Name *</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                required
                placeholder="e.g., CORSAIR Gaming"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Branding</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="primaryColor">Primary Color *</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    id="primaryColor"
                    name="primaryColor"
                    value={formData.primaryColor}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={handleChange}
                    name="primaryColor"
                    placeholder="#ffd700"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="secondaryColor">Secondary Color *</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    id="secondaryColor"
                    name="secondaryColor"
                    value={formData.secondaryColor}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    value={formData.secondaryColor}
                    onChange={handleChange}
                    name="secondaryColor"
                    placeholder="#ffed4e"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="logoUrl">Logo URL</label>
              <input
                type="url"
                id="logoUrl"
                name="logoUrl"
                value={formData.logoUrl}
                onChange={handleChange}
                placeholder="https://example.com/logo.svg"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Google Drive Configuration</h2>
            <div className="form-group">
              <label htmlFor="googleDriveBriefFolderId">Brief Folder ID *</label>
              <input
                type="text"
                id="googleDriveBriefFolderId"
                name="googleDriveBriefFolderId"
                value={formData.googleDriveBriefFolderId}
                onChange={handleChange}
                required
                placeholder="1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697"
              />
            </div>
            <div className="form-group">
              <label htmlFor="googleDriveProductImagesFolderId">Product Images Folder ID *</label>
              <input
                type="text"
                id="googleDriveProductImagesFolderId"
                name="googleDriveProductImagesFolderId"
                value={formData.googleDriveProductImagesFolderId}
                onChange={handleChange}
                required
                placeholder="1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS"
              />
            </div>
            <div className="form-group">
              <label htmlFor="googleDriveEditedResultsFolderId">Edited Results Folder ID *</label>
              <input
                type="text"
                id="googleDriveEditedResultsFolderId"
                name="googleDriveEditedResultsFolderId"
                value={formData.googleDriveEditedResultsFolderId}
                onChange={handleChange}
                required
                placeholder="17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>API Keys</h2>
            {isEditing && (
              <p style={{ color: '#ffd700', fontSize: '14px', marginBottom: '16px' }}>
                For security, existing API keys are never displayed. Leave fields empty to keep current keys, or enter new keys to update them.
              </p>
            )}
            <div className="form-group">
              <label htmlFor="wavespeedApiKey">Wavespeed API Key {!isEditing && '*'}</label>
              <input
                type="password"
                id="wavespeedApiKey"
                name="wavespeedApiKey"
                value={formData.wavespeedApiKey}
                onChange={handleChange}
                required={!isEditing}
                placeholder={isEditing ? "Enter new key to update (optional)" : "Enter Wavespeed API key"}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="openaiApiKey">OpenAI API Key {!isEditing && '*'}</label>
              <input
                type="password"
                id="openaiApiKey"
                name="openaiApiKey"
                value={formData.openaiApiKey}
                onChange={handleChange}
                required={!isEditing}
                placeholder={isEditing ? "Enter new key to update (optional)" : "Enter OpenAI API key"}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>AI Configuration</h2>
            <div className="form-group">
              <label htmlFor="defaultPrompt">Default Prompt Template</label>
              <textarea
                id="defaultPrompt"
                name="defaultPrompt"
                value={formData.defaultPrompt}
                onChange={handleChange}
                rows="4"
                placeholder="Enter default AI prompt template for image editing..."
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="batchSize">Batch Size *</label>
                <input
                  type="number"
                  id="batchSize"
                  name="batchSize"
                  value={formData.batchSize}
                  onChange={handleChange}
                  required
                  min="1"
                  max="50"
                />
              </div>
              <div className="form-group">
                <label htmlFor="estimatedManualTimePerImageMinutes">Manual Time Per Image (minutes) *</label>
                <input
                  type="number"
                  id="estimatedManualTimePerImageMinutes"
                  name="estimatedManualTimePerImageMinutes"
                  value={formData.estimatedManualTimePerImageMinutes}
                  onChange={handleChange}
                  required
                  min="1"
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={handleCancel} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-save">
              {saving ? 'Saving...' : isEditing ? 'Update Brand' : 'Create Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BrandForm;
