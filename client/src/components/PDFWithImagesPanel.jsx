import { useState, useRef } from 'react';
import { ToastContainer, useToast } from './Toast';
import './PDFWithImagesPanel.css';

function PDFWithImagesPanel({ onSubmit, uploading, onBack }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [images, setImages] = useState([]);
  const { toasts, removeToast, showError, showWarning } = useToast();
  
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
      showError('Please upload a PDF file only');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showError('PDF must be less than 50MB');
      return;
    }

    setPdfFile(file);
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
    const validFiles = [];
    
    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        showError(`${file.name} is not a valid image format (JPG/PNG only)`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        showError(`${file.name} is larger than 20MB`);
        continue;
      }
      if (images.length + validFiles.length >= 20) {
        showWarning('Maximum 20 images allowed');
        break;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setImages([...images, ...validFiles]);
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const removePdf = () => {
    setPdfFile(null);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (!pdfFile) {
      showError('Please upload a PDF brief');
      return;
    }
    if (images.length === 0) {
      showError('Please upload at least one image');
      return;
    }
    
    onSubmit(pdfFile, images);
  };

  const canSubmit = pdfFile && images.length > 0 && !uploading;

  return (
    <div className="pdf-images-panel">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {onBack && (
        <button className="back-button" onClick={onBack}>
          ← Change Method
        </button>
      )}
      <div className="panel-header">
        <h2>PDF Brief + Separate Images</h2>
        <p>Upload your PDF brief and high-resolution images separately</p>
      </div>

      <div className="upload-sections">
        {/* PDF Upload Section */}
        <div className="upload-section">
          <h3>1. Upload PDF Brief</h3>
          <div
            className={`drop-zone ${pdfFile ? 'has-file' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handlePdfDrop}
            onClick={() => pdfInputRef.current?.click()}
          >
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              onChange={handlePdfSelect}
              style={{ display: 'none' }}
            />
            
            {pdfFile ? (
              <div className="file-preview">
                <div className="file-icon">📄</div>
                <div className="file-info">
                  <span className="file-name">{pdfFile.name}</span>
                  <span className="file-size">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <button
                  className="remove-file-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePdf();
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="drop-content">
                <div className="drop-icon">📄</div>
                <h4>Drop PDF here or click to browse</h4>
                <p>Your creative brief with image specifications</p>
                <span className="size-hint">Max 50MB</span>
              </div>
            )}
          </div>
        </div>

        {/* Images Upload Section */}
        <div className="upload-section">
          <h3>2. Upload Product Images</h3>
          <div
            className={`drop-zone images-zone ${images.length > 0 ? 'has-files' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleImagesDrop}
            onClick={() => imagesInputRef.current?.click()}
          >
            <input
              ref={imagesInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              multiple
              onChange={handleImagesSelect}
              style={{ display: 'none' }}
            />
            
            {images.length > 0 ? (
              <div className="images-preview">
                <div className="images-header">
                  <span className="image-count">{images.length} image{images.length !== 1 ? 's' : ''}</span>
                  <span className="add-more">Click or drop to add more</span>
                </div>
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
                      <span className="image-name">{img.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="drop-content">
                <div className="drop-icon">🖼️</div>
                <h4>Drop images here or click to browse</h4>
                <p>High-resolution product images (JPG, PNG)</p>
                <span className="size-hint">Max 20MB each, up to 20 images</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="matching-info">
        <div className="info-icon">💡</div>
        <p>
          Images will be automatically matched to specifications in your PDF based on upload order.
          For best results, upload images in the same order as they appear in your brief.
        </p>
      </div>

      <div className="submit-section">
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
            `Start AI Editing (${images.length} image${images.length !== 1 ? 's' : ''})`
          )}
        </button>
      </div>
    </div>
  );
}

export default PDFWithImagesPanel;
