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

  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  const [logoFile, setLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');

  const [brandbookFile, setBrandbookFile] = useState(null);
  const [uploadingBrandbook, setUploadingBrandbook] = useState(false);
  const [brandbookAnalysis, setBrandbookAnalysis] = useState(null);

  const [availableBrands, setAvailableBrands] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    displayName: '',
    primaryColor: '#ffd700',
    secondaryColor: '#ffed4e',
    logoUrl: '',
    websiteUrl: '',
    brandbookUrl: '',
    parentBrandId: null,
    brandType: 'primary',
    authPassword: '',
    googleDriveBriefFolderId: '',
    googleDriveProductImagesFolderId: '',
    googleDriveEditedResultsFolderId: '',
    wavespeedApiKey: '',
    geminiApiKey: '',
    preferredImageApi: 'wavespeed',
    geminiImageModel: 'gemini-3-pro-image-preview',
    openaiApiKey: '',
    defaultPrompt: '',
    batchSize: 15,
    estimatedManualTimePerImageMinutes: 5,
  });

  useEffect(() => {
    loadAvailableBrands();
    if (isEditing) {
      loadBrand();
    }
  }, [id]);

  const loadAvailableBrands = async () => {
    try {
      const response = await fetch('/api/brand/list');
      if (!response.ok) {
        throw new Error('Failed to load brands');
      }
      const result = await response.json();
      const primaryBrands = result.brands.filter(b => b.brandType === 'primary' || !b.brandType);
      setAvailableBrands(primaryBrands);
    } catch (err) {
      console.error('Error loading brands:', err);
    }
  };

  const loadBrand = async () => {
    try {
      const response = await fetch('/api/brand/list');
      if (!response.ok) {
        throw new Error('Failed to load brands');
      }
      const result = await response.json();
      const data = result.brands.find(b => b.id === parseInt(id));

      if (!data) {
        throw new Error('Brand not found');
      }

      setFormData({
        name: data.name || '',
        slug: data.slug || '',
        displayName: data.displayName || '',
        primaryColor: data.primaryColor || '#ffd700',
        secondaryColor: data.secondaryColor || '#ffed4e',
        logoUrl: data.logoUrl || '',
        websiteUrl: data.websiteUrl || '',
        brandbookUrl: data.brandbookUrl || '',
        parentBrandId: data.parentBrandId || null,
        brandType: data.brandType || 'primary',
        authPassword: '',
        googleDriveBriefFolderId: data.googleDriveBriefFolderId || '',
        googleDriveProductImagesFolderId: data.googleDriveProductImagesFolderId || '',
        googleDriveEditedResultsFolderId: data.googleDriveEditedResultsFolderId || '',
        wavespeedApiKey: '',
        geminiApiKey: '',
        preferredImageApi: data.preferredImageApi || 'wavespeed',
        geminiImageModel: data.geminiImageModel || 'gemini-3-pro-image-preview',
        openaiApiKey: '',
        defaultPrompt: data.defaultPrompt || '',
        batchSize: data.batchSize || 15,
        estimatedManualTimePerImageMinutes: data.estimatedManualTimePerImageMinutes || 5,
      });

      if (data.logoUrl) {
        setLogoPreview(data.logoUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let finalValue = value;

    if (type === 'number') {
      finalValue = parseInt(value) || 0;
    } else if (name === 'parentBrandId') {
      finalValue = value ? parseInt(value) : null;
    }

    setFormData({
      ...formData,
      [name]: finalValue,
      ...(name === 'parentBrandId' && {
        brandType: finalValue ? 'sub_account' : 'primary'
      })
    });
  };

  const handleScrapeWebsite = async () => {
    if (!scrapeUrl) {
      setScrapeError('Please enter a website URL');
      return;
    }

    setScraping(true);
    setScrapeError('');

    try {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/scrape-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminToken,
        },
        body: JSON.stringify({ websiteUrl: scrapeUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape website');
      }

      setFormData({
        ...formData,
        name: data.name || formData.name,
        displayName: data.displayName || formData.displayName,
        slug: data.slug || formData.slug,
        primaryColor: data.primaryColor || formData.primaryColor,
        secondaryColor: data.secondaryColor || formData.secondaryColor,
        logoUrl: data.logoUrl || formData.logoUrl,
        websiteUrl: data.websiteUrl || scrapeUrl,
      });

      if (data.logoUrl) {
        setLogoPreview(data.logoUrl);
      }

      setScrapeUrl('');
    } catch (err) {
      setScrapeError(err.message);
    } finally {
      setScraping(false);
    }
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) {
      setError('Please select a logo file');
      return;
    }

    setUploadingLogo(true);
    setError('');

    try {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        throw new Error('Not authenticated');
      }

      const formDataUpload = new FormData();
      formDataUpload.append('logo', logoFile);

      const response = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        headers: {
          'X-Admin-Key': adminToken,
        },
        body: formDataUpload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload logo');
      }

      setFormData({
        ...formData,
        logoUrl: data.publicUrl,
      });

      setLogoFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBrandbookFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please select a PDF file for the brandbook');
        return;
      }
      setBrandbookFile(file);
    }
  };

  const handleUploadBrandbook = async () => {
    if (!brandbookFile) {
      setError('Please select a brandbook PDF file');
      return;
    }

    setUploadingBrandbook(true);
    setError('');
    setBrandbookAnalysis(null);

    try {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        throw new Error('Not authenticated');
      }

      const formDataUpload = new FormData();
      formDataUpload.append('brandbook', brandbookFile);

      const response = await fetch('/api/admin/upload-brandbook', {
        method: 'POST',
        headers: {
          'X-Admin-Key': adminToken,
        },
        body: formDataUpload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload brandbook');
      }

      const updates = {
        brandbookUrl: data.publicUrl,
      };

      if (data.analyzed && data.guidelines) {
        const g = data.guidelines;
        if (g.primaryColor) updates.primaryColor = g.primaryColor;
        if (g.secondaryColor) updates.secondaryColor = g.secondaryColor;
        if (g.defaultPromptTemplate) updates.defaultPrompt = g.defaultPromptTemplate;
        if (g.estimatedManualTimePerImageMinutes) {
          updates.estimatedManualTimePerImageMinutes = g.estimatedManualTimePerImageMinutes;
        }

        setBrandbookAnalysis(g);
      }

      setFormData({
        ...formData,
        ...updates,
      });

      setBrandbookFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingBrandbook(false);
    }
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

      const payload = { ...formData };

      if (isEditing) {
        if (!payload.wavespeedApiKey) delete payload.wavespeedApiKey;
        if (!payload.geminiApiKey) delete payload.geminiApiKey;
        if (!payload.openaiApiKey) delete payload.openaiApiKey;
        if (!payload.authPassword) delete payload.authPassword;
      }

      if (payload.googleDriveBriefFolderId) {
        payload.briefFolderId = payload.googleDriveBriefFolderId;
        delete payload.googleDriveBriefFolderId;
      }
      if (payload.googleDriveProductImagesFolderId) {
        payload.productImagesFolderId = payload.googleDriveProductImagesFolderId;
        delete payload.googleDriveProductImagesFolderId;
      }
      if (payload.googleDriveEditedResultsFolderId) {
        payload.editedResultsFolderId = payload.googleDriveEditedResultsFolderId;
        delete payload.googleDriveEditedResultsFolderId;
      }
      if (payload.defaultPrompt) {
        payload.defaultPromptTemplate = payload.defaultPrompt;
        delete payload.defaultPrompt;
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
          {!isEditing && (
            <div className="form-section automated-setup">
              <h2>🚀 Automated Setup</h2>
              <p className="section-help">Use these tools to automatically extract brand information and save time</p>

              <div className="automation-card">
                <h3>Website Scraper</h3>
                <p className="help-text">Enter a website URL to automatically extract brand name, colors, and logo</p>
                <div className="automation-controls">
                  <input
                    type="url"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="automation-input"
                  />
                  <button
                    type="button"
                    onClick={handleScrapeWebsite}
                    disabled={scraping || !scrapeUrl}
                    className="btn-action"
                  >
                    {scraping ? 'Scraping...' : 'Scrape Website'}
                  </button>
                </div>
                {scrapeError && <div className="inline-error">{scrapeError}</div>}
              </div>

              <div className="automation-card">
                <h3>Logo Upload</h3>
                <p className="help-text">Upload your brand logo (PNG, JPG, or SVG)</p>
                <div className="automation-controls">
                  <input
                    type="file"
                    onChange={handleLogoFileChange}
                    accept=".png,.jpg,.jpeg,.svg"
                    className="file-input"
                  />
                  <button
                    type="button"
                    onClick={handleUploadLogo}
                    disabled={uploadingLogo || !logoFile}
                    className="btn-action"
                  >
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </button>
                </div>
                {logoPreview && (
                  <div className="logo-preview">
                    <img src={logoPreview} alt="Logo preview" />
                  </div>
                )}
              </div>

              <div className="automation-card">
                <h3>Brandbook Analysis (Optional)</h3>
                <p className="help-text">Upload a brand guideline PDF to automatically extract colors and style preferences</p>
                <div className="automation-controls">
                  <input
                    type="file"
                    onChange={handleBrandbookFileChange}
                    accept=".pdf"
                    className="file-input"
                  />
                  <button
                    type="button"
                    onClick={handleUploadBrandbook}
                    disabled={uploadingBrandbook || !brandbookFile}
                    className="btn-action"
                  >
                    {uploadingBrandbook ? 'Analyzing...' : 'Upload & Analyze'}
                  </button>
                </div>
                {brandbookAnalysis && (
                  <div className="analysis-results">
                    <h4>Analysis Results:</h4>
                    <ul>
                      <li><strong>Visual Style:</strong> {brandbookAnalysis.visualStyle}</li>
                      {brandbookAnalysis.brandValues && (
                        <li><strong>Brand Values:</strong> {brandbookAnalysis.brandValues.join(', ')}</li>
                      )}
                      <li><strong>Colors:</strong> {brandbookAnalysis.primaryColor}, {brandbookAnalysis.secondaryColor}</li>
                      {brandbookAnalysis.imageStyleGuidelines && (
                        <li><strong>Image Guidelines:</strong> {brandbookAnalysis.imageStyleGuidelines}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

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

            <div className="form-group">
              <label htmlFor="websiteUrl">Website URL</label>
              <input
                type="url"
                id="websiteUrl"
                name="websiteUrl"
                value={formData.websiteUrl}
                onChange={handleChange}
                placeholder="https://www.example.com"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Brand Hierarchy</h2>
            <p className="section-help">Create sub-accounts under a parent brand (e.g., LifeTrek Medical under CORSAIR)</p>
            <div className="form-group">
              <label htmlFor="parentBrandId">Parent Brand (Optional)</label>
              <select
                id="parentBrandId"
                name="parentBrandId"
                value={formData.parentBrandId || ''}
                onChange={handleChange}
              >
                <option value="">None - This is a primary brand</option>
                {availableBrands.map(brand => (
                  <option key={brand.id} value={brand.id}>
                    {brand.displayName}
                  </option>
                ))}
              </select>
              <p className="field-help">
                {formData.parentBrandId
                  ? `This will be a sub-account under ${availableBrands.find(b => b.id === formData.parentBrandId)?.displayName}`
                  : 'This is a primary brand account'}
              </p>
            </div>
          </div>

          <div className="form-section">
            <h2>Brand Authentication</h2>
            <p className="section-help">Set a password for brand-specific access (separate from admin login)</p>
            <div className="form-group">
              <label htmlFor="authPassword">Brand Password {!isEditing && '(Optional)'}</label>
              <input
                type="password"
                id="authPassword"
                name="authPassword"
                value={formData.authPassword}
                onChange={handleChange}
                placeholder={isEditing ? "Leave empty to keep current password" : "Set a password for this brand"}
                autoComplete="new-password"
              />
              <p className="field-help">
                This password allows brand users to access their specific brand portal without admin privileges
              </p>
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
              <p className="field-help">Auto-populated from uploads or website scraping</p>
            </div>

            <div className="form-group">
              <label htmlFor="brandbookUrl">Brandbook URL</label>
              <input
                type="url"
                id="brandbookUrl"
                name="brandbookUrl"
                value={formData.brandbookUrl}
                onChange={handleChange}
                placeholder="https://drive.google.com/..."
                readOnly
              />
              <p className="field-help">Auto-populated from brandbook upload</p>
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
              <label htmlFor="geminiApiKey">Gemini API Key {!isEditing && '(Optional)'}</label>
              <input
                type="password"
                id="geminiApiKey"
                name="geminiApiKey"
                value={formData.geminiApiKey}
                onChange={handleChange}
                placeholder={isEditing ? "Enter new key to update (optional)" : "Enter Gemini API key"}
                autoComplete="off"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="preferredImageApi">Preferred Image Provider</label>
                <select
                  id="preferredImageApi"
                  name="preferredImageApi"
                  value={formData.preferredImageApi}
                  onChange={handleChange}
                >
                  <option value="wavespeed">Wavespeed (Legacy)</option>
                  <option value="gemini">Gemini Native (Recommended)</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="geminiImageModel">Gemini Model</label>
                <select
                  id="geminiImageModel"
                  name="geminiImageModel"
                  value={formData.geminiImageModel}
                  onChange={handleChange}
                  disabled={formData.preferredImageApi !== 'gemini'}
                >
                  <option value="gemini-3-pro-image-preview">Gemini 3 Pro (Best Quality)</option>
                  <option value="gemini-2.5-flash-image">Gemini 2.5 Flash (Fastest)</option>
                </select>
              </div>
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
              <p className="field-help">Auto-populated from brandbook analysis</p>
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
