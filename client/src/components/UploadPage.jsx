import { useState, useRef } from 'react';
import './UploadPage.css';

function UploadPage({ onComplete }) {
  const [briefType, setBriefType] = useState('pdf');
  const [pdfFile, setPdfFile] = useState(null);
  const [textPrompt, setTextPrompt] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
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

  const handleSubmit = async () => {
    // For DOCX, images are optional (will use embedded images)
    const isDOCX = pdfFile && pdfFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (!isDOCX && images.length === 0) return;
    if (briefType === 'pdf' && !pdfFile) return;
    if (briefType === 'text' && !textPrompt.trim()) return;
    
    setUploading(true);
    setError('');

    try {
      let jobId;
      
      if (briefType === 'pdf') {
        const pdfFormData = new FormData();
        pdfFormData.append('pdf', pdfFile);
        
        const pdfResponse = await fetch('/api/upload/pdf', {
          method: 'POST',
          body: pdfFormData
        });
        
        if (!pdfResponse.ok) {
          const errorData = await pdfResponse.json();
          throw new Error(errorData.error || errorData.details || 'PDF upload failed');
        }
        
        const pdfData = await pdfResponse.json();
        jobId = pdfData.jobId;
      } else {
        const textResponse = await fetch('/api/upload/text-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: textPrompt })
        });
        
        if (!textResponse.ok) {
          const errorData = await textResponse.json();
          throw new Error(errorData.error || errorData.details || 'Prompt upload failed');
        }
        
        const textData = await textResponse.json();
        jobId = textData.jobId;
      }

      // Check if this was a DOCX with embedded images
      const responseData = briefType === 'pdf' ? pdfData : textData;
      const hasEmbeddedImages = responseData.embeddedImageCount > 0;
      
      // Only upload separate images if we have them and didn't get embedded ones
      if (images.length > 0 && !hasEmbeddedImages) {
        const imagesFormData = new FormData();
        images.forEach(image => {
          imagesFormData.append('images', image);
        });
        imagesFormData.append('jobId', jobId);
        
        const imagesResponse = await fetch('/api/upload/images', {
          method: 'POST',
          body: imagesFormData
        });
        
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

  return (
    <div className="upload-page">
      <div className="container">
        <header className="header">
          <h1>CORSAIR Image Editor</h1>
          <p>Upload your creative brief and product images to get started</p>
        </header>

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

        {error && <div className="error-message">{error}</div>}

        <button 
          className="button button-primary submit-button"
          onClick={handleSubmit}
          disabled={!canSubmit}
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
      </div>
    </div>
  );
}

export default UploadPage;
