/**
 * Validation utilities for brief submissions
 * Supports all three submission methods: PDF/DOCX, PDF+Images, Structured Form
 */

/**
 * Validates an individual image specification
 * @param {Object} spec - Image specification object
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
export function validateImageSpec(spec) {
    const errors = [];

    // Title validation
    if (!spec.title || typeof spec.title !== 'string' || spec.title.trim().length === 0) {
        errors.push('Title is required');
    } else if (spec.title.length > 50) {
        errors.push('Title must be 50 characters or less');
    }

    // Subtitle validation
    if (!spec.subtitle || typeof spec.subtitle !== 'string' || spec.subtitle.trim().length === 0) {
        errors.push('Subtitle is required');
    } else if (spec.subtitle.length > 200) {
        errors.push('Subtitle must be 200 characters or less');
    }

    // Optional fields validation (if provided)
    if (spec.asset && spec.asset.length > 100) {
        errors.push('Asset name must be 100 characters or less');
    }

    if (spec.variant && spec.variant.length > 50) {
        errors.push('Variant name must be 50 characters or less');
    }

    if (spec.customPrompt && spec.customPrompt.length > 2000) {
        errors.push('Custom prompt must be 2000 characters or less');
    }

    return errors;
}

/**
 * Validates an uploaded image file
 * @param {Object} file - Multer file object
 * @returns {string|null} Error message or null if valid
 */
export function validateImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 20 * 1024 * 1024; // 20MB

    if (!file) {
        return 'Image file is required';
    }

    if (!validTypes.includes(file.mimetype)) {
        return `Invalid file type "${file.mimetype}". Only JPG and PNG are allowed.`;
    }

    if (file.size > maxSize) {
        return `File "${file.originalname}" exceeds 20MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
    }

    return null;
}

/**
 * Validates structured brief submission
 * @param {Array<Object>} imageSpecs - Array of image specifications
 * @param {Array<Object>} files - Array of uploaded files
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validateStructuredBrief(imageSpecs, files) {
    const errors = [];

    // Check if specs array exists and is valid
    if (!Array.isArray(imageSpecs)) {
        errors.push('Image specifications must be an array');
        return { valid: false, errors };
    }

    if (imageSpecs.length === 0) {
        errors.push('At least one image specification is required');
        return { valid: false, errors };
    }

    if (imageSpecs.length > 20) {
        errors.push('Maximum 20 images per submission');
        return { valid: false, errors };
    }

    // Check if files array exists and matches specs count
    if (!Array.isArray(files)) {
        errors.push('Image files must be provided');
        return { valid: false, errors };
    }

    if (files.length !== imageSpecs.length) {
        errors.push(`Expected ${imageSpecs.length} images, received ${files.length}`);
        return { valid: false, errors };
    }

    // Validate each spec
    imageSpecs.forEach((spec, index) => {
        const specErrors = validateImageSpec(spec);
        if (specErrors.length > 0) {
            errors.push(`Image ${index + 1}: ${specErrors.join(', ')}`);
        }
    });

    // Validate each file
    files.forEach((file, index) => {
        const fileError = validateImageFile(file);
        if (fileError) {
            errors.push(`Image ${index + 1}: ${fileError}`);
        }
    });

    // Check for duplicate asset names (warning, not error)
    const assetNames = imageSpecs
        .map(spec => spec.asset)
        .filter(asset => asset && asset.trim().length > 0);

    const duplicateAssets = assetNames.filter((asset, index) =>
        assetNames.indexOf(asset) !== index
    );

    if (duplicateAssets.length > 0) {
        // This is a warning, not a blocking error
        console.warn(`Warning: Duplicate asset names found: ${duplicateAssets.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validates PDF with separate images submission
 * @param {Object} pdfFile - PDF file object
 * @param {Array<Object>} imageFiles - Array of image files
 * @param {number} expectedImageCount - Number of images expected from PDF specs
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validatePDFWithImages(pdfFile, imageFiles, expectedImageCount = null) {
    const errors = [];

    // Validate PDF file
    if (!pdfFile) {
        errors.push('PDF file is required');
        return { valid: false, errors };
    }

    const validPdfTypes = ['application/pdf'];
    if (!validPdfTypes.includes(pdfFile.mimetype)) {
        errors.push('File must be a PDF');
    }

    const maxPdfSize = 50 * 1024 * 1024; // 50MB
    if (pdfFile.size > maxPdfSize) {
        errors.push(`PDF file exceeds 50MB limit (${(pdfFile.size / 1024 / 1024).toFixed(2)}MB)`);
    }

    // Validate image files
    if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
        errors.push('At least one image file is required');
        return { valid: false, errors };
    }

    if (imageFiles.length > 20) {
        errors.push('Maximum 20 images per submission');
    }

    // Check if image count matches expected count (if provided)
    if (expectedImageCount !== null && imageFiles.length !== expectedImageCount) {
        errors.push(`PDF specifies ${expectedImageCount} images, but ${imageFiles.length} were uploaded`);
    }

    // Validate each image file
    imageFiles.forEach((file, index) => {
        const fileError = validateImageFile(file);
        if (fileError) {
            errors.push(`Image ${index + 1}: ${fileError}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Sanitizes user input to prevent XSS and injection attacks
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }

    // Remove any HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
}

/**
 * Generates default AI prompt from title and subtitle
 * @param {string} title - Image title
 * @param {string} subtitle - Image subtitle
 * @returns {string} Generated AI prompt
 */
export function generateDefaultPrompt(title, subtitle) {
    const sanitizedTitle = sanitizeInput(title);
    const sanitizedSubtitle = sanitizeInput(subtitle);

    return `Add a VERY SUBTLE dark gradient overlay ONLY at the top 20-25% of the image, fading from semi-transparent dark gray (30-40% opacity) to fully transparent. Keep the gradient extremely light to preserve all original image details, colors, and textures - the product and background must remain clearly visible and unchanged. The gradient should only provide a subtle backdrop for text readability. Place the following text at the top portion: ${sanitizedTitle} in white Montserrat Extra Bold font (all caps, approximately 44-56px, adjust size based on image dimensions). Below the title, add ${sanitizedSubtitle} in white Montserrat Regular font (approximately 16-22px). Apply a very subtle drop shadow to text only (1-2px offset, 20-30% opacity black) for readability. CRITICAL: Preserve ALL original image details, sharpness, colors, and product features - this should look like a minimal, professional overlay, not heavy editing. Output as high-resolution image.`;
}
