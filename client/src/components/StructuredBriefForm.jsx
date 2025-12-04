import { useState, useRef } from 'react';
import './StructuredBriefForm.css';

/**
 * Structured form for manual brief entry with validation
 * Allows users to upload images and enter specifications for each
 */
function StructuredBriefForm({ onSubmit, uploading }) {
    const [projectName, setProjectName] = useState('');
    const [imageSpecs, setImageSpecs] = useState([createEmptySpec()]);
    const [validationErrors, setValidationErrors] = useState({});

    const fileInputRefs = useRef([]);

    function createEmptySpec() {
        return {
            id: `spec-${Date.now()}-${Math.random()}`,
            image: null,
            imagePreview: null,
            title: '',
            subtitle: '',
            asset: '',
            variant: '',
            customPrompt: '',
            useDefaultPrompt: true
        };
    }

    const addImageSpec = () => {
        if (imageSpecs.length >= 20) {
            alert('Maximum 20 images per submission');
            return;
        }
        setImageSpecs([...imageSpecs, createEmptySpec()]);
        fileInputRefs.current.push(null);
    };

    const removeImageSpec = (index) => {
        if (imageSpecs.length === 1) {
            alert('At least one image is required');
            return;
        }

        const newSpecs = imageSpecs.filter((_, i) => i !== index);
        setImageSpecs(newSpecs);
        fileInputRefs.current.splice(index, 1);

        // Clear validation errors for this spec
        const newErrors = { ...validationErrors };
        delete newErrors[index];
        setValidationErrors(newErrors);
    };

    const updateSpec = (index, field, value) => {
        const newSpecs = [...imageSpecs];
        newSpecs[index] = { ...newSpecs[index], [field]: value };
        setImageSpecs(newSpecs);

        // Clear validation error for this field
        if (validationErrors[index]?.[field]) {
            const newErrors = { ...validationErrors };
            delete newErrors[index][field];
            setValidationErrors(newErrors);
        }
    };

    const handleImageUpload = (index, file) => {
        if (!file) return;

        // Validate file
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            alert('Only JPG and PNG images are allowed');
            return;
        }

        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
            alert(`File "${file.name}" exceeds 20MB limit`);
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const newSpecs = [...imageSpecs];
            newSpecs[index] = {
                ...newSpecs[index],
                image: file,
                imagePreview: e.target.result,
                asset: newSpecs[index].asset || file.name.replace(/\.[^/.]+$/, '') // Suggest asset name from filename
            };
            setImageSpecs(newSpecs);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = (index) => {
        const newSpecs = [...imageSpecs];
        newSpecs[index] = {
            ...newSpecs[index],
            image: null,
            imagePreview: null
        };
        setImageSpecs(newSpecs);

        // Reset file input
        if (fileInputRefs.current[index]) {
            fileInputRefs.current[index].value = '';
        }
    };

    // Bulk actions
    const applyTitleToAll = () => {
        const firstTitle = imageSpecs[0].title;
        if (!firstTitle) {
            alert('Please enter a title in the first image spec');
            return;
        }

        const newSpecs = imageSpecs.map(spec => ({ ...spec, title: firstTitle }));
        setImageSpecs(newSpecs);
    };

    const applySubtitleToAll = () => {
        const firstSubtitle = imageSpecs[0].subtitle;
        if (!firstSubtitle) {
            alert('Please enter a subtitle in the first image spec');
            return;
        }

        const newSpecs = imageSpecs.map(spec => ({ ...spec, subtitle: firstSubtitle }));
        setImageSpecs(newSpecs);
    };

    const duplicateSpec = (index) => {
        if (imageSpecs.length >= 20) {
            alert('Maximum 20 images per submission');
            return;
        }

        const specToDuplicate = imageSpecs[index];
        const newSpec = {
            ...createEmptySpec(),
            title: specToDuplicate.title,
            subtitle: specToDuplicate.subtitle,
            variant: specToDuplicate.variant,
            customPrompt: specToDuplicate.customPrompt,
            useDefaultPrompt: specToDuplicate.useDefaultPrompt
            // Note: Don't duplicate the image itself
        };

        const newSpecs = [...imageSpecs];
        newSpecs.splice(index + 1, 0, newSpec);
        setImageSpecs(newSpecs);
    };

    const validateForm = () => {
        const errors = {};
        let isValid = true;

        imageSpecs.forEach((spec, index) => {
            const specErrors = {};

            if (!spec.image) {
                specErrors.image = 'Image is required';
                isValid = false;
            }

            if (!spec.title || spec.title.trim().length === 0) {
                specErrors.title = 'Title is required';
                isValid = false;
            } else if (spec.title.length > 50) {
                specErrors.title = 'Title must be 50 characters or less';
                isValid = false;
            }

            if (!spec.subtitle || spec.subtitle.trim().length === 0) {
                specErrors.subtitle = 'Subtitle is required';
                isValid = false;
            } else if (spec.subtitle.length > 200) {
                specErrors.subtitle = 'Subtitle must be 200 characters or less';
                isValid = false;
            }

            if (Object.keys(specErrors).length > 0) {
                errors[index] = specErrors;
            }
        });

        setValidationErrors(errors);
        return isValid;
    };

    const handleSubmit = () => {
        if (!validateForm()) {
            alert('Please fix validation errors before submitting');
            return;
        }

        // Prepare data for submission
        const formData = {
            projectName: projectName || 'Untitled Project',
            imageSpecs: imageSpecs.map(spec => ({
                title: spec.title,
                subtitle: spec.subtitle,
                asset: spec.asset,
                variant: spec.variant,
                customPrompt: spec.customPrompt,
                useDefaultPrompt: spec.useDefaultPrompt
            })),
            images: imageSpecs.map(spec => spec.image)
        };

        onSubmit(formData);
    };

    const getValidationSummary = () => {
        const totalImages = imageSpecs.length;
        const imagesWithFiles = imageSpecs.filter(s => s.image).length;
        const imagesWithTitle = imageSpecs.filter(s => s.title.trim()).length;
        const imagesWithSubtitle = imageSpecs.filter(s => s.subtitle.trim()).length;
        const readyCount = imageSpecs.filter(s => s.image && s.title.trim() && s.subtitle.trim()).length;

        return {
            totalImages,
            imagesWithFiles,
            imagesWithTitle,
            imagesWithSubtitle,
            readyCount,
            allReady: readyCount === totalImages
        };
    };

    const summary = getValidationSummary();

    return (
        <div className="structured-brief-form">
            <div className="form-header">
                <h2>Structured Brief Form</h2>
                <p>Fill out specifications for each image with real-time validation</p>
            </div>

            {/* Project Name */}
            <div className="project-info">
                <label htmlFor="projectName">
                    Project Name <span className="optional">(optional)</span>
                </label>
                <input
                    id="projectName"
                    type="text"
                    placeholder="e.g., Corsair ONE Campaign Q4 2025"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    maxLength={100}
                />
            </div>

            {/* Bulk Actions */}
            {imageSpecs.length > 1 && (
                <div className="bulk-actions">
                    <h3>Bulk Actions</h3>
                    <div className="action-buttons">
                        <button type="button" onClick={applyTitleToAll} className="bulk-btn">
                            Apply Title to All
                        </button>
                        <button type="button" onClick={applySubtitleToAll} className="bulk-btn">
                            Apply Subtitle to All
                        </button>
                    </div>
                </div>
            )}

            {/* Image Specifications */}
            <div className="image-specs-container">
                {imageSpecs.map((spec, index) => (
                    <div key={spec.id} className={`image-spec-row ${validationErrors[index] ? 'has-errors' : ''}`}>
                        <div className="spec-header">
                            <h3>Image {index + 1}</h3>
                            <div className="spec-actions">
                                <button
                                    type="button"
                                    onClick={() => duplicateSpec(index)}
                                    className="icon-btn"
                                    title="Duplicate this spec"
                                >
                                    📋
                                </button>
                                {imageSpecs.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeImageSpec(index)}
                                        className="icon-btn remove"
                                        title="Remove this image"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="spec-content">
                            {/* Image Upload */}
                            <div className="image-upload-section">
                                <label>Image {validationErrors[index]?.image && <span className="error">{validationErrors[index].image}</span>}</label>
                                {spec.imagePreview ? (
                                    <div className="image-preview">
                                        <img src={spec.imagePreview} alt={`Preview ${index + 1}`} />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="remove-image-btn"
                                        >
                                            ✕ Remove
                                        </button>
                                        <div className="image-info">
                                            {spec.image.name} ({(spec.image.size / 1024 / 1024).toFixed(2)} MB)
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="image-dropzone"
                                        onClick={() => fileInputRefs.current[index]?.click()}
                                    >
                                        <div className="dropzone-content">
                                            <span className="icon">🖼️</span>
                                            <p>Click to upload image</p>
                                            <span className="hint">JPG, PNG - Max 20MB</span>
                                        </div>
                                        <input
                                            ref={(el) => (fileInputRefs.current[index] = el)}
                                            type="file"
                                            accept=".jpg,.jpeg,.png"
                                            onChange={(e) => handleImageUpload(index, e.target.files[0])}
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Specifications */}
                            <div className="spec-fields">
                                <div className="field">
                                    <label htmlFor={`title-${index}`}>
                                        Title * {validationErrors[index]?.title && <span className="error">{validationErrors[index].title}</span>}
                                    </label>
                                    <input
                                        id={`title-${index}`}
                                        type="text"
                                        placeholder="e.g., CORSAIR ONE I600"
                                        value={spec.title}
                                        onChange={(e) => updateSpec(index, 'title', e.target.value)}
                                        maxLength={50}
                                        className={validationErrors[index]?.title ? 'invalid' : ''}
                                    />
                                    <span className="char-count">{spec.title.length}/50</span>
                                </div>

                                <div className="field">
                                    <label htmlFor={`subtitle-${index}`}>
                                        Subtitle * {validationErrors[index]?.subtitle && <span className="error">{validationErrors[index].subtitle}</span>}
                                    </label>
                                    <textarea
                                        id={`subtitle-${index}`}
                                        placeholder="e.g., A Compact PC Powerhouse Built for Performance"
                                        value={spec.subtitle}
                                        onChange={(e) => updateSpec(index, 'subtitle', e.target.value)}
                                        maxLength={200}
                                        rows={3}
                                        className={validationErrors[index]?.subtitle ? 'invalid' : ''}
                                    />
                                    <span className="char-count">{spec.subtitle.length}/200</span>
                                </div>

                                <div className="field-row">
                                    <div className="field">
                                        <label htmlFor={`asset-${index}`}>
                                            Asset Name <span className="optional">(optional)</span>
                                        </label>
                                        <input
                                            id={`asset-${index}`}
                                            type="text"
                                            placeholder="e.g., corsair_one_i600_metal_dark"
                                            value={spec.asset}
                                            onChange={(e) => updateSpec(index, 'asset', e.target.value)}
                                            maxLength={100}
                                        />
                                    </div>

                                    <div className="field">
                                        <label htmlFor={`variant-${index}`}>
                                            Variant <span className="optional">(optional)</span>
                                        </label>
                                        <input
                                            id={`variant-${index}`}
                                            type="text"
                                            placeholder="e.g., Metal Dark"
                                            value={spec.variant}
                                            onChange={(e) => updateSpec(index, 'variant', e.target.value)}
                                            maxLength={50}
                                        />
                                    </div>
                                </div>

                                {/* Advanced: Custom Prompt */}
                                <details className="advanced-section">
                                    <summary>Advanced: Custom AI Prompt</summary>
                                    <div className="field">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={spec.useDefaultPrompt}
                                                onChange={(e) => updateSpec(index, 'useDefaultPrompt', e.target.checked)}
                                            />
                                            Use default prompt template (recommended)
                                        </label>
                                        {!spec.useDefaultPrompt && (
                                            <textarea
                                                placeholder="Enter custom AI editing instructions..."
                                                value={spec.customPrompt}
                                                onChange={(e) => updateSpec(index, 'customPrompt', e.target.value)}
                                                rows={4}
                                                maxLength={2000}
                                            />
                                        )}
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add More Button */}
            {imageSpecs.length < 20 && (
                <button type="button" onClick={addImageSpec} className="add-spec-btn">
                    + Add Another Image
                </button>
            )}

            {/* Validation Summary */}
            <div className={`validation-summary ${summary.allReady ? 'ready' : 'pending'}`}>
                <h3>Submission Status</h3>
                <div className="summary-stats">
                    <div className="stat">
                        <span className="label">Total Images:</span>
                        <span className="value">{summary.totalImages}</span>
                    </div>
                    <div className="stat">
                        <span className="label">Images Uploaded:</span>
                        <span className="value">{summary.imagesWithFiles}/{summary.totalImages}</span>
                    </div>
                    <div className="stat">
                        <span className="label">Ready to Process:</span>
                        <span className="value">{summary.readyCount}/{summary.totalImages}</span>
                    </div>
                </div>
                {summary.allReady ? (
                    <p className="status-message success">✓ All images ready for processing!</p>
                ) : (
                    <p className="status-message pending">⚠️ Complete all required fields to submit</p>
                )}
            </div>

            {/* Submit Button */}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={!summary.allReady || uploading}
                className="submit-btn"
            >
                {uploading ? (
                    <>
                        <span className="spinner"></span>
                        Uploading...
                    </>
                ) : (
                    `Submit ${summary.totalImages} Image${summary.totalImages > 1 ? 's' : ''}`
                )}
            </button>
        </div>
    );
}

export default StructuredBriefForm;
