import { useState, useRef } from 'react';
import { authenticatedFetch, postFormData, postJSON } from '../utils/api';
import marketplacePresets, { getPresetById, getPresetList } from '../config/marketplacePresets';
import BriefMethodSelector from './BriefMethodSelector';
import StructuredBriefForm from './StructuredBriefForm';
import PDFWithImagesPanel from './PDFWithImagesPanel';
import LogoConfirmationPanel from './LogoConfirmationPanel';
import './UploadPage.css';

const validateDriveFolderUrl = (url) => {
  if (!url || url.trim() === '') return { valid: true, folderId: null };
  
  const patterns = [
    /^https?:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
    /^https?:\/\/drive\.google\.com\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{25,}$)/
  ];
  
  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) {
      return { valid: true, folderId: match[1] };
    }
  }
  
  return { valid: false, folderId: null };
};

function UploadPage({ onComplete }) {
  // Method selection: null = not selected, 'document', 'pdf-images', 'form'
  const [submissionMethod, setSubmissionMethod] = useState(null);

  // Legacy state for document/text methods
  const [briefType, setBriefType] = useState('pdf');
  const [pdfFile, setPdfFile] = useState(null);
  const [textPrompt, setTextPrompt] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedPreset, setSelectedPreset] = useState('default');
  const [driveDestinationUrl, setDriveDestinationUrl] = useState('');
  const [driveUrlError, setDriveUrlError] = useState('');
  
  // Logo confirmation state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  
  const pdfInputRef = useRef(null);
  const imagesInputRef = useRef(null);

  const handlePdfDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    validatePdf(file);
  };

  const handlePdfSelect = (e) => {
    const file = e.target.files[0];
    validatePdf(file);
  };

  const validatePdf = (file) => {
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or DOCX file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File must be less than 50MB');
      return;
    }

    setPdfFile(file);
    setError('');
  };

  const handleImagesDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    validateImages(files);
  };

  const handleImagesSelect = (e) => {
    const files = Array.from(e.target.files);
    validateImages(files);
  };

  const validateImages = (files) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const validFiles = files.filter(file => {
      if (!validTypes.includes(file.type)) {
        setError(`${file.name} is not a valid image format`);
        return false;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(`${file.name} is larger than 20MB`);
        return false;
      }
      return true;
    });

    setImages([...images, ...validFiles]);
    setError('');
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleDriveUrlChange = (e) => {
    const url = e.target.value;
    setDriveDestinationUrl(url);
    
    if (url.trim()) {
      const validation = validateDriveFolderUrl(url);
      if (!validation.valid) {
        setDriveUrlError('Invalid Google Drive folder URL. Use format: https://drive.google.com/drive/folders/...');
      } else {
        setDriveUrlError('');
      }
    } else {
      setDriveUrlError('');
    }
  };

  // Handler for structured form submission
  const handleStructuredFormSubmit = async (formData) => {
    setUploading(true);
    setError('');
    
    try {
      const multipartData = new FormData();
      multipartData.append('projectName', formData.projectName);
      multipartData.append('imageSpecs', JSON.stringify(formData.imageSpecs));
      
      formData.images.forEach(image => {
        multipartData.append('images', image);
      });
      
      const response = await postFormData('/api/upload/structured-brief', multipartData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Submission failed');
      }
      
      const data = await response.json();
      onComplete(data.jobId);
      
    } catch (err) {
      console.error('Structured form submission error:', err);
      setError(err.message);
      setUploading(false);
    }
  };

  // Handler for PDF + Images submission
  const handlePDFWithImagesSubmit = async (pdfFile, imageFiles) => {
    setUploading(true);
    setError('');
    
    try {
      const multipartData = new FormData();
      multipartData.append('pdf', pdfFile);
      
      imageFiles.forEach(image => {
        multipartData.append('images', image);
      });
      
      const response = await postFormData('/api/upload/pdf-with-images', multipartData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Submission failed');
      }
      
      const data = await response.json();
      onComplete(data.jobId);
      
    } catch (err) {
      console.error('PDF + Images submission error:', err);
      setError(err.message);
      setUploading(false);
    }
  };

  // Handler for document/text submission (original method)
  const handleSubmit = async () => {
    const isDOCX = pdfFile && pdfFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isDOCX && images.length === 0) return;
    if (briefType === 'pdf' && !pdfFile) return;
    if (briefType === 'text' && !textPrompt.trim()) return;
    
    if (driveDestinationUrl.trim()) {
      const validation = validateDriveFolderUrl(driveDestinationUrl);
      if (!validation.valid) {
        setError('Please enter a valid Google Drive folder URL');
        return;
      }
    }
    
    setUploading(true);
    setError('');

    try {
      let jobId;
      let pdfData, textData;
      
      const preset = getPresetById(selectedPreset);
      const driveValidation = validateDriveFolderUrl(driveDestinationUrl);
      const customFolderId = driveValidation.folderId;
      
      if (briefType === 'pdf') {
        const pdfFormData = new FormData();
        pdfFormData.append('pdf', pdfFile);
        pdfFormData.append('marketplacePreset', JSON.stringify(preset));
        if (customFolderId) {
          pdfFormData.append('driveDestinationFolderId', customFolderId);
        }
        
        const pdfResponse = await postFormData('/api/upload/pdf', pdfFormData);

        if (!pdfResponse.ok) {
          const errorData = await pdfResponse.json();
          throw new Error(errorData.error || errorData.details || 'PDF upload failed');
        }

        pdfData = await pdfResponse.json();
        jobId = pdfData.jobId;
      } else {
        const textResponse = await postJSON('/api/upload/text-prompt', { 
          prompt: textPrompt,
          marketplacePreset: preset,
          driveDestinationFolderId: customFolderId
        });
        
        if (!textResponse.ok) {
          const errorData = await textResponse.json();
          throw new Error(errorData.error || errorData.details || 'Prompt upload failed');
        }

        textData = await textResponse.json();
        jobId = textData.jobId;
      }

      const responseData = briefType === 'pdf' ? pdfData : textData;
      const hasEmbeddedImages = responseData?.embeddedImageCount > 0;
      
      // Check if logo confirmation is required
      if (responseData?.requiresConfirmation) {
        console.log('[Upload] Showing logo confirmation panel');
        setConfirmationData({
          jobId: responseData.jobId,
          imageSpecs: responseData.imageSpecs,
          images: responseData.images
        });
        setShowConfirmation(true);
        setUploading(false);
        return;
      }
      
      if (images.length > 0 && !hasEmbeddedImages) {
        const imagesFormData = new FormData();
        images.forEach(image => {
          imagesFormData.append('images', image);
        });
        imagesFormData.append('jobId', jobId);

        const imagesResponse = await postFormData('/api/upload/images', imagesFormData);

        if (!imagesResponse.ok) {
          const errorData = await imagesResponse.json();
          throw new Error(errorData.error || errorData.details || 'Images upload failed');
        }
      }

      onComplete(jobId);
    } catch (err) {
      console.error('Upload error:', err);
      const errorMsg = err.message || 'Upload failed. Please try again.';
      setError(errorMsg);
      setUploading(false);
    }
  };

  const isDOCX = pdfFile && pdfFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const canSubmit = !uploading && (
    (briefType === 'pdf' && pdfFile && (isDOCX || images.length > 0)) ||
    (briefType === 'text' && textPrompt.trim() && images.length > 0)
  );

  // Handler for logo confirmation
  const handleLogoConfirm = (jobId) => {
    setShowConfirmation(false);
    setConfirmationData(null);
    onComplete(jobId);
  };

  const handleLogoCancel = () => {
    setShowConfirmation(false);
    setConfirmationData(null);
    setPdfFile(null);
    setImages([]);
  };

  // If showing confirmation panel, render it
  if (showConfirmation && confirmationData) {
    return (
      <div className="upload-page">
        <div className="upload-container" style={{ maxWidth: '1200px' }}>
          <header className="header">
            <div className="logo-container">
              <img
                src="/assets/corsair-logo.png"
                alt="CORSAIR"
                className="corsair-logo"
              />
            </div>
            <h1>AI Image Editor</h1>
            <p>Review and confirm logo assignments before processing</p>
          </header>
          
          <LogoConfirmationPanel
            jobId={confirmationData.jobId}
            imageSpecs={confirmationData.imageSpecs}
            images={confirmationData.images}
            onConfirm={handleLogoConfirm}
            onCancel={handleLogoCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="upload-page">
      <div className="upload-container">
        <header className="header">
          <div className="logo-container">
            <img
              src="/assets/corsair-logo.png"
              alt="CORSAIR"
              className="corsair-logo"
            />
          </div>
          <h1>AI Image Editor</h1>
          <p>Upload your creative brief and product images to get started</p>
        </header>

        {/* Show method selector if no method selected */}
        {!submissionMethod ? (
          <BriefMethodSelector
            onMethodSelect={setSubmissionMethod}
            currentMethod={submissionMethod}
          />
        ) : (
          <>
            {/* Render selected method's interface */}
            {submissionMethod === 'form' && (
              <StructuredBriefForm
                onSubmit={handleStructuredFormSubmit}
                uploading={uploading}
                onBack={() => {
                  setSubmissionMethod(null);
                  setError('');
                }}
              />
            )}

            {submissionMethod === 'pdf-images' && (
              <PDFWithImagesPanel
                onSubmit={handlePDFWithImagesSubmit}
                uploading={uploading}
                onBack={() => {
                  setSubmissionMethod(null);
                  setError('');
                }}
              />
            )}

            {submissionMethod === 'document' && (
              <>
                <button
                  className="back-button"
                  onClick={() => {
                    setSubmissionMethod(null);
                    setPdfFile(null);
                    setImages([]);
                    setTextPrompt('');
                    setError('');
                  }}
                  disabled={uploading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '2px solid #3A3A3A',
                    color: '#B0B0B0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: '24px'
                  }}
                >
                  ← Change Method
                </button>
                <div className="brief-type-toggle">
                  <button
                    className={`toggle-btn ${briefType === 'pdf' ? 'active' : ''}`}
                    onClick={() => setBriefType('pdf')}
                  >
                    📄 Document Brief
                  </button>
                  <button
                    className={`toggle-btn ${briefType === 'text' ? 'active' : ''}`}
                    onClick={() => setBriefType('text')}
                  >
                    ✍️ Text Prompt
                  </button>
                </div>

                <div className="upload-panels">
                  {briefType === 'pdf' ? (
                    <div
                      className="upload-panel"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handlePdfDrop}
                      onClick={() => pdfInputRef.current.click()}
                    >
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handlePdfSelect}
                        style={{ display: 'none' }}
                      />
                      <div className="panel-content">
                        <div className="icon">📄</div>
                        {pdfFile ? (
                          <>
                            <h3>{pdfFile.name}</h3>
                            <p>{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            {pdfFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && (
                              <p className="hint" style={{ color: '#4CAF50', marginTop: '8px' }}>
                                ✓ Images will be extracted from DOCX
                              </p>
                            )}
                            <button
                              className="button button-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPdfFile(null);
                              }}
                            >
                              Replace
                            </button>
                          </>
                        ) : (
                          <>
                            <h3>Upload Brief (PDF or DOCX)</h3>
                            <p>Drag & drop or click to browse</p>
                            <span className="hint">PDF or DOCX - Max 50MB</span>
                            <span className="hint" style={{ marginTop: '4px' }}>DOCX files with embedded images will auto-extract them</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="upload-panel text-prompt-panel">
                      <div className="panel-content">
                        <div className="icon">✍️</div>
                        <h3>Enter Your Editing Instructions</h3>
                        <textarea
                          className="text-prompt-input"
                          placeholder="Describe how you want your images edited... (e.g., 'Make the background white, add a subtle shadow, and enhance the colors')"
                          value={textPrompt}
                          onChange={(e) => setTextPrompt(e.target.value)}
                          rows={6}
                        />
                        <span className="hint">{textPrompt.length} characters</span>
                      </div>
                    </div>
                  )}

                  <div
                    className="upload-panel"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleImagesDrop}
                    onClick={() => imagesInputRef.current.click()}
                    style={{ opacity: isDOCX ? 0.6 : 1 }}
                  >
                    <input
                      ref={imagesInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      multiple
                      onChange={handleImagesSelect}
                      style={{ display: 'none' }}
                      disabled={isDOCX}
                    />
                    <div className="panel-content">
                      <div className="icon">🖼️</div>
                      {isDOCX && images.length === 0 ? (
                        <>
                          <h3>Images will be extracted from DOCX</h3>
                          <p>No separate upload needed</p>
                          <span className="hint">DOCX contains embedded images</span>
                        </>
                      ) : images.length > 0 ? (
                        <>
                          <h3>{images.length} images uploaded</h3>
                          <div className="image-grid">
                            {images.map((img, idx) => (
                              <div key={idx} className="image-thumb">
                                <img src={URL.createObjectURL(img)} alt={img.name} />
                                <button
                                  className="remove-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeImage(idx);
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <h3>Upload Product Images</h3>
                          <p>Drag & drop or click to browse</p>
                          <span className="hint">JPG, PNG - Max 20MB each</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="settings-panel">
                  <h3 className="settings-title">Output Settings</h3>
                  
                  <div className="settings-row">
                    <div className="setting-field">
                      <label htmlFor="marketplace-preset">Marketplace Preset</label>
                      <select
                        id="marketplace-preset"
                        className="preset-select"
                        value={selectedPreset}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                      >
                        {getPresetList().map(preset => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                      {selectedPreset !== 'default' && (
                        <span className="preset-info">
                          {getPresetById(selectedPreset).description}
                        </span>
                      )}
                    </div>
                    
                    <div className="setting-field">
                      <label htmlFor="drive-destination">
                        Drive Destination Folder
                        <span className="optional-badge">Optional</span>
                      </label>
                      <input
                        id="drive-destination"
                        type="text"
                        className={`drive-url-input ${driveUrlError ? 'error' : ''}`}
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={driveDestinationUrl}
                        onChange={handleDriveUrlChange}
                      />
                      {driveUrlError && (
                        <span className="field-error">{driveUrlError}</span>
                      )}
                      <span className="field-hint">
                        Leave empty to use default folder. Paste a Google Drive folder URL to save outputs there.
                      </span>
                    </div>
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button 
                  className="button button-primary submit-button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || !!driveUrlError}
                >
                  {uploading ? (
                    <>
                      <span className="spinner"></span>
                      Uploading...
                    </>
                  ) : (
                    'Start AI Editing'
                  )}
                </button>
              </>
            )}

            {/* Show error for form and pdf-images methods */}
            {(submissionMethod === 'form' || submissionMethod === 'pdf-images') && error && (
              <div className="error-message">{error}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default UploadPage;
