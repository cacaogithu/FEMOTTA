import { useState, useRef } from 'react';
import './UploadPage.css';

function UploadPage({ onComplete }) {
  const [pdfFile, setPdfFile] = useState(null);
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
    
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      setError('PDF must be less than 50MB');
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
    if (!pdfFile || images.length === 0) return;
    
    setUploading(true);
    setError('');

    try {
      const pdfFormData = new FormData();
      pdfFormData.append('pdf', pdfFile);
      
      const pdfResponse = await fetch('/api/upload/pdf', {
        method: 'POST',
        body: pdfFormData
      });
      
      if (!pdfResponse.ok) throw new Error('PDF upload failed');
      
      const pdfData = await pdfResponse.json();
      const jobId = pdfData.jobId;

      const imagesFormData = new FormData();
      images.forEach(image => {
        imagesFormData.append('images', image);
      });
      imagesFormData.append('jobId', jobId);
      
      const imagesResponse = await fetch('/api/upload/images', {
        method: 'POST',
        body: imagesFormData
      });
      
      if (!imagesResponse.ok) throw new Error('Images upload failed');
      
      onComplete(jobId);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const canSubmit = pdfFile && images.length > 0 && !uploading;

  return (
    <div className="upload-page">
      <div className="container">
        <header className="header">
          <h1>AI Marketing Image Editor</h1>
          <p>Upload your creative brief and product images to get started</p>
        </header>

        <div className="upload-panels">
          <div 
            className="upload-panel"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handlePdfDrop}
            onClick={() => pdfInputRef.current.click()}
          >
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              onChange={handlePdfSelect}
              style={{ display: 'none' }}
            />
            <div className="panel-content">
              <div className="icon">📄</div>
              {pdfFile ? (
                <>
                  <h3>{pdfFile.name}</h3>
                  <p>{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
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
                  <h3>Upload PDF Brief</h3>
                  <p>Drag & drop or click to browse</p>
                  <span className="hint">Max 50MB</span>
                </>
              )}
            </div>
          </div>

          <div 
            className="upload-panel"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleImagesDrop}
            onClick={() => imagesInputRef.current.click()}
          >
            <input
              ref={imagesInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              multiple
              onChange={handleImagesSelect}
              style={{ display: 'none' }}
            />
            <div className="panel-content">
              <div className="icon">🖼️</div>
              {images.length > 0 ? (
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
