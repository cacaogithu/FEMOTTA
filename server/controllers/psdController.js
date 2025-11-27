  import { getJobWithFallback } from '../utils/jobStore.js';
  import { downloadFileFromDrive } from '../utils/googleDrive.js';
  import 'ag-psd/initialize-canvas.js'; // Required for Node.js
  import { writePsdBuffer } from 'ag-psd';
  import { createCanvas, Image } from 'canvas';
  import jwt from 'jsonwebtoken';
  import crypto from 'crypto';

  // Secret for signing download tokens (generate random if not set)
  const PSD_TOKEN_SECRET = process.env.PSD_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

  // ag-psd DOES support real editable text layers
  const SUPPORTS_TEXT_LAYERS = true;

  // Helper function to extract text specs for a specific image
  function getTextSpecsForImage(job, imageIndex) {
    const specs = { title: null, subtitle: null };
    
    // Priority 1: Check editedImages directly (added during processing)
    if (job.editedImages && job.editedImages[imageIndex]) {
      const editedImage = job.editedImages[imageIndex];
      if (editedImage.title) specs.title = editedImage.title;
      if (editedImage.subtitle) specs.subtitle = editedImage.subtitle;
    }
    
    // Priority 2: Try to get from imageSpecs array (extracted from brief)
    if (!specs.title && job.imageSpecs && Array.isArray(job.imageSpecs)) {
      const spec = job.imageSpecs[imageIndex] || 
                   job.imageSpecs.find(s => s.image_number === imageIndex + 1);
      if (spec) {
        if (!specs.title) specs.title = spec.title || null;
        if (!specs.subtitle) specs.subtitle = spec.subtitle || null;
      }
    }
    
    // Priority 3: Fallback - try to extract from the prompt used
    if (!specs.title && job.editedImages && job.editedImages[imageIndex]) {
      const editedImage = job.editedImages[imageIndex];
      if (editedImage.promptUsed) {
        // Try to parse title/subtitle from prompt text
        const titleMatch = editedImage.promptUsed.match(/title[:\s]+["']?([^"'\n,]+)["']?/i) ||
                          editedImage.promptUsed.match(/headline[:\s]+["']?([^"'\n,]+)["']?/i);
        const subtitleMatch = editedImage.promptUsed.match(/subtitle[:\s]+["']?([^"'\n,]+)["']?/i) ||
                              editedImage.promptUsed.match(/copy[:\s]+["']?([^"'\n,]+)["']?/i);
        if (titleMatch && !specs.title) specs.title = titleMatch[1].trim();
        if (subtitleMatch && !specs.subtitle) specs.subtitle = subtitleMatch[1].trim();
      }
    }
    
    console.log(`[PSD Download] Text specs for image ${imageIndex}:`, specs);
    return specs;
  }

  // Calculate text positioning and font sizes based on image dimensions
  function calculateTextLayout(width, height, textSpecs) {
    // Calculate responsive font sizes based on image dimensions
    const titleFontSize = Math.max(36, Math.min(72, Math.floor(width * 0.045)));
    const subtitleFontSize = Math.max(16, Math.min(32, Math.floor(width * 0.02)));
    
    // Position text in the top portion of the image (matching AI placement)
    const topMargin = Math.floor(height * 0.08);
    const leftMargin = Math.floor(width * 0.05);
    
    const layout = {
      title: null,
      subtitle: null
    };
    
    if (textSpecs.title) {
      layout.title = {
        text: textSpecs.title.toUpperCase(),
        x: leftMargin,
        y: topMargin + titleFontSize,
        fontSize: titleFontSize,
        fontFamily: 'Saira',
        fontWeight: 'Bold',
        fontPostScriptName: 'Saira-Bold',
        color: { r: 255, g: 255, b: 255 },
        alignment: 'left'
      };
    }
    
    if (textSpecs.subtitle) {
      const subtitleY = topMargin + titleFontSize + Math.floor(titleFontSize * 0.6);
      layout.subtitle = {
        text: textSpecs.subtitle,
        x: leftMargin,
        y: subtitleY + subtitleFontSize,
        fontSize: subtitleFontSize,
        fontFamily: 'Saira',
        fontWeight: 'Regular',
        fontPostScriptName: 'Saira-Regular',
        color: { r: 255, g: 255, b: 255 },
        alignment: 'left'
      };
    }
    
    return layout;
  }

  // Helper function to create a complete, Photoshop-compatible text layer
  function createEditableTextLayer(name, textContent, x, y, fontSize, fontName, color, isBold = false) {
    const textLength = textContent.length;
    
    return {
      name: name,
      blendMode: 'normal',
      opacity: 1,
      left: x,
      top: y - fontSize,
      right: x + (fontSize * textLength * 0.6),
      bottom: y + Math.floor(fontSize * 0.3),
      text: {
        text: textContent,
        transform: [1, 0, 0, 1, x, y],
        antiAlias: 'smooth',
        orientation: 'horizontal',
        warp: {
          style: 'none',
          value: 0,
          perspective: 0,
          perspectiveOther: 0,
          rotate: 'horizontal'
        },
        gridAndGuideInfo: {
          gridIsOn: false,
          showGrid: false,
          gridSize: 18,
          gridLeading: 22,
          gridColor: { r: 0, g: 0, b: 0 },
          gridLeadingFillColor: { r: 0, g: 0, b: 0 },
          alignLineHeightToGridFlags: false
        },
        useFractionalGlyphWidths: true,
        style: {
          font: { name: fontName },
          fontSize: fontSize,
          fauxBold: isBold,
          fauxItalic: false,
          autoLeading: true,
          leading: 0,
          horizontalScale: 1,
          verticalScale: 1,
          tracking: 0,
          autoKerning: true,
          kerning: 0,
          baselineShift: 0,
          fontCaps: 0,
          fontBaseline: 0,
          underline: false,
          strikethrough: false,
          ligatures: true,
          dLigatures: false,
          baselineDirection: 2,
          tsume: 0,
          styleRunAlignment: 2,
          language: 0,
          noBreak: false,
          fillColor: color,
          strokeColor: { r: 0, g: 0, b: 0 },
          fillFlag: true,
          strokeFlag: false,
          fillFirst: true,
          yUnderline: 1,
          outlineWidth: 1,
          characterDirection: 0,
          hindiNumbers: false,
          kashida: 1,
          diacriticPos: 2
        },
        styleRuns: [{
          length: textLength,
          style: {
            font: { name: fontName },
            fontSize: fontSize,
            fauxBold: isBold,
            fauxItalic: false,
            autoLeading: true,
            leading: 0,
            horizontalScale: 1,
            verticalScale: 1,
            tracking: 0,
            autoKerning: true,
            kerning: 0,
            baselineShift: 0,
            fillColor: color,
            strokeColor: { r: 0, g: 0, b: 0 },
            fillFlag: true,
            strokeFlag: false
          }
        }],
        paragraphStyle: {
          justification: 'left',
          firstLineIndent: 0,
          startIndent: 0,
          endIndent: 0,
          spaceBefore: 0,
          spaceAfter: 0,
          autoHyphenate: true,
          hyphenatedWordSize: 6,
          preHyphen: 2,
          postHyphen: 2,
          consecutiveHyphens: 8,
          zone: 36,
          wordSpacing: [0.8, 1, 1.33],
          letterSpacing: [0, 0, 0],
          glyphSpacing: [1, 1, 1],
          autoLeading: 1.2,
          leadingType: 0,
          hanging: false,
          burasagari: false,
          kinsokuOrder: 0,
          everyLineComposer: false
        },
        paragraphStyleRuns: [{
          length: textLength,
          style: {
            justification: 'left',
            firstLineIndent: 0,
            startIndent: 0,
            endIndent: 0,
            spaceBefore: 0,
            spaceAfter: 0,
            autoLeading: 1.2,
            leadingType: 0,
            autoHyphenate: true,
            everyLineComposer: false
          }
        }]
      }
    };
  }

  // Helper function to create editable text layers using ag-psd text layer API
  function createTextLayers(width, height, textSpecs) {
    const layers = [];
    const layout = calculateTextLayout(width, height, textSpecs);
    
    if (layout.title) {
      layers.push(createEditableTextLayer(
        'Title - Editable Text',
        layout.title.text,
        layout.title.x,
        layout.title.y,
        layout.title.fontSize,
        layout.title.fontPostScriptName,
        layout.title.color,
        true
      ));
    }
    
    if (layout.subtitle) {
      layers.push(createEditableTextLayer(
        'Subtitle - Editable Text',
        layout.subtitle.text,
        layout.subtitle.x,
        layout.subtitle.y,
        layout.subtitle.fontSize,
        layout.subtitle.fontPostScriptName,
        layout.subtitle.color,
        false
      ));
    }
    
    return layers;
  }

  // Generate JSON metadata for designers (fallback if text layers don't work)
  function generateTextMetadata(width, height, textSpecs) {
    const layout = calculateTextLayout(width, height, textSpecs);
    
    return {
      supportsTextLayers: SUPPORTS_TEXT_LAYERS,
      canvasSize: { width, height },
      textLayers: {
        title: layout.title ? {
          content: layout.title.text,
          position: { x: layout.title.x, y: layout.title.y },
          font: {
            family: layout.title.fontFamily,
            weight: layout.title.fontWeight,
            postScriptName: layout.title.fontPostScriptName,
            size: layout.title.fontSize
          },
          color: {
            rgb: layout.title.color,
            hex: `#${layout.title.color.r.toString(16).padStart(2, '0')}${layout.title.color.g.toString(16).padStart(2, '0')}${layout.title.color.b.toString(16).padStart(2, '0')}`
          },
          alignment: layout.title.alignment
        } : null,
        subtitle: layout.subtitle ? {
          content: layout.subtitle.text,
          position: { x: layout.subtitle.x, y: layout.subtitle.y },
          font: {
            family: layout.subtitle.fontFamily,
            weight: layout.subtitle.fontWeight,
            postScriptName: layout.subtitle.fontPostScriptName,
            size: layout.subtitle.fontSize
          },
          color: {
            rgb: layout.subtitle.color,
            hex: `#${layout.subtitle.color.r.toString(16).padStart(2, '0')}${layout.subtitle.color.g.toString(16).padStart(2, '0')}${layout.subtitle.color.b.toString(16).padStart(2, '0')}`
          },
          alignment: layout.subtitle.alignment
        } : null
      }
    };
  }

  export async function downloadPsd(req, res) {
    try {
      const { jobId, imageIndex } = req.params;

      const job = await getJobWithFallback(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (!job.editedImages || job.editedImages.length === 0) {
        return res.status(404).json({ error: 'No edited images found for this job' });
      }

      const index = parseInt(imageIndex);
      if (isNaN(index) || index < 0 || index >= job.editedImages.length) {
        return res.status(400).json({ error: 'Invalid image index' });
      }

      const imageData = job.editedImages[index];

      console.log('[PSD Download] Fetching images from Google Drive...');

      // Verify Google Drive credentials before attempting download
      if (!imageData.originalImageId || !imageData.editedImageId) {
        throw new Error('Missing image IDs in job data');
      }

      // Download both original and edited images from Google Drive
      const [originalBuffer, editedBuffer] = await Promise.all([
        downloadFileFromDrive(imageData.originalImageId),
        downloadFileFromDrive(imageData.editedImageId)
      ]);

      if (!originalBuffer || !editedBuffer) {
        throw new Error('Failed to download images from Google Drive');
      }

      console.log('[PSD Download] Images downloaded, processing...');

      // Load both images properly with promises to ensure they're fully loaded
      const loadImage = (buffer) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = (err) => reject(new Error('Failed to load image into canvas'));
          img.src = buffer;
        });
      };

      const [originalImg, editedImg] = await Promise.all([
        loadImage(originalBuffer),
        loadImage(editedBuffer)
      ]);

      // Use the maximum dimensions from both images to prevent cropping
      const width = Math.max(originalImg.width, editedImg.width);
      const height = Math.max(originalImg.height, editedImg.height);

      // Helper to create canvas and draw image
      const createLayerCanvas = (img) => {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d', { pixelFormat: 'RGB24' });
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        return canvas;
      };

      const originalCanvas = createLayerCanvas(originalImg);
      const editedCanvas = createLayerCanvas(editedImg);

      // Create Difference Layer (visualize changes)
      const diffCanvas = createCanvas(width, height);
      const diffCtx = diffCanvas.getContext('2d');
      diffCtx.drawImage(originalCanvas, 0, 0);
      diffCtx.globalCompositeOperation = 'difference';
      diffCtx.drawImage(editedCanvas, 0, 0);

      console.log('[PSD Download] Creating layered PSD with editable text...');

      // Extract text specifications for this image
      const textSpecs = getTextSpecsForImage(job, index);
      
      // Create editable text layers
      const textLayers = createTextLayers(width, height, textSpecs);
      
      console.log(`[PSD Download] Created ${textLayers.length} editable text layers`);

      // Create PSD document with organized layers
      // Structure: Text Group (editable) > Comparison Group (reference images)
      const psd = {
        width,
        height,
        channels: 3,
        bitsPerChannel: 8,
        colorMode: 3,
        children: [
          // Editable Text Group - at the top for easy access
          ...(textLayers.length > 0 ? [{
            name: 'Editable Text',
            opened: true,
            children: textLayers
          }] : []),
          // Reference Images Group
          {
            name: 'Reference Images',
            opened: true,
            children: [
              {
                name: 'AI Edited (Reference)',
                canvas: editedCanvas,
                blendMode: 'normal',
                opacity: 255
              },
              {
                name: 'Original',
                visible: false,
                canvas: originalCanvas,
                blendMode: 'normal',
                opacity: 255
              },
              {
                name: 'Difference Highlight',
                visible: false,
                canvas: diffCanvas,
                blendMode: 'normal',
                opacity: 255
              }
            ]
          }
        ]
      };

      // Generate PSD buffer with invalidateTextLayers option for proper text rendering
      const psdArrayBuffer = writePsdBuffer(psd, { 
        invalidateTextLayers: true,
        generateThumbnail: true
      });
      const psdBuffer = Buffer.from(psdArrayBuffer);

      console.log('[PSD Download] PSD created successfully, size:', psdBuffer.length, 'bytes');
      console.log('[PSD Download] Text layers included:', textLayers.length > 0 ? 'Yes' : 'No');

      // Send as downloadable file
      const fileName = `${imageData.originalName.replace(/\.[^/.]+$/, '')}_edited.psd`;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', psdBuffer.length);
      res.send(psdBuffer);

      console.log('[PSD Download] Sent to client:', fileName);

    } catch (error) {
      console.error('[PSD Download] Error:', error);
      res.status(500).json({
        error: 'Failed to generate PSD file',
        details: error.message
      });
    }
  }

  // GET /api/psd/info/:jobId/:imageIndex - Get PSD metadata without downloading
  export async function getPsdInfo(req, res) {
    try {
      const { jobId, imageIndex } = req.params;

      const job = await getJobWithFallback(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (!job.editedImages || job.editedImages.length === 0) {
        return res.status(404).json({ error: 'No edited images found for this job' });
      }

      const index = parseInt(imageIndex);
      if (isNaN(index) || index < 0 || index >= job.editedImages.length) {
        return res.status(400).json({ error: 'Invalid image index' });
      }

      const imageData = job.editedImages[index];
      
      // Extract text specifications for this image
      const textSpecs = getTextSpecsForImage(job, index);
      
      // Get actual image dimensions by loading the edited image
      let width = 1200;  // fallback
      let height = 800;  // fallback
      
      try {
        if (imageData.editedImageId) {
          console.log('[PSD Info] Loading edited image to get actual dimensions...');
          const editedBuffer = await downloadFileFromDrive(imageData.editedImageId);
          
          const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = editedBuffer;
          });
          
          width = img.width;
          height = img.height;
          console.log(`[PSD Info] Actual image dimensions: ${width}x${height}`);
        }
      } catch (dimError) {
        console.warn('[PSD Info] Could not load image for dimensions, using fallback:', dimError.message);
      }
      
      // Generate metadata with actual dimensions
      const metadata = generateTextMetadata(width, height, textSpecs);
      
      res.json({
        success: true,
        supportsTextLayers: SUPPORTS_TEXT_LAYERS,
        imageName: imageData.originalName,
        imageIndex: index,
        actualDimensions: { width, height },
        metadata: metadata,
        notes: {
          photoshopWarning: 'When opening in Photoshop, click "Update" on text layers to render them properly',
          fontRequirement: 'Montserrat font family should be installed for best results',
          layerStructure: 'Text layers are in "Editable Text" group, reference images in "Reference Images" group'
        }
      });

    } catch (error) {
      console.error('[PSD Info] Error:', error);
      res.status(500).json({
        error: 'Failed to get PSD info',
        details: error.message
      });
    }
  }

  // Generate a signed download URL for PSD files (bypasses fetch/blob browser issues)
  export async function generatePsdSignedUrl(req, res) {
    try {
      const { jobId, imageIndex } = req.params;
      const brandId = req.brand?.id || req.user?.brandId || 'default';

      // Validate job and image exist
      const job = await getJobWithFallback(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (!job.editedImages || job.editedImages.length === 0) {
        return res.status(404).json({ error: 'No edited images found for this job' });
      }

      const index = parseInt(imageIndex);
      if (isNaN(index) || index < 0 || index >= job.editedImages.length) {
        return res.status(400).json({ error: 'Invalid image index' });
      }

      // Create a short-lived token (60 seconds)
      const token = jwt.sign(
        {
          jobId,
          imageIndex: index,
          brandId,
          type: 'psd_download'
        },
        PSD_TOKEN_SECRET,
        { expiresIn: '60s' }
      );

      // Return the signed URL
      const downloadUrl = `/api/psd/file/${token}`;
      
      console.log(`[PSD Signed URL] Generated token for job ${jobId}, image ${index}`);
      
      res.json({
        success: true,
        downloadUrl,
        expiresIn: 60
      });

    } catch (error) {
      console.error('[PSD Signed URL] Error:', error);
      res.status(500).json({
        error: 'Failed to generate download URL',
        details: error.message
      });
    }
  }

  // Stream PSD file using signed token (no auth header required)
  export async function downloadPsdWithToken(req, res) {
    try {
      const { token } = req.params;

      // Verify the token
      let decoded;
      try {
        decoded = jwt.verify(token, PSD_TOKEN_SECRET);
      } catch (tokenError) {
        console.error('[PSD Token Download] Token verification failed:', tokenError.message);
        return res.status(401).json({ error: 'Invalid or expired download link' });
      }

      if (decoded.type !== 'psd_download') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      const { jobId, imageIndex } = decoded;

      console.log(`[PSD Token Download] Valid token for job ${jobId}, image ${imageIndex}`);

      const job = await getJobWithFallback(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (!job.editedImages || !job.editedImages[imageIndex]) {
        return res.status(404).json({ error: 'Image not found' });
      }

      const imageData = job.editedImages[imageIndex];

      console.log('[PSD Token Download] Fetching image from Google Drive...');

      // Download only the edited image (skip original and difference to reduce file size)
      const editedBuffer = await downloadFileFromDrive(imageData.editedImageId);

      if (!editedBuffer) {
        throw new Error('Failed to download image from Google Drive');
      }

      console.log('[PSD Token Download] Image downloaded, creating optimized PSD...');

      // Load the image
      const editedImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error('Failed to load image into canvas'));
        img.src = editedBuffer;
      });

      const width = editedImg.width;
      const height = editedImg.height;

      // Create canvas for the edited image only (reduces file size significantly)
      const editedCanvas = createCanvas(width, height);
      const editedCtx = editedCanvas.getContext('2d');
      editedCtx.drawImage(editedImg, 0, 0);

      // Extract text specifications for this image
      const textSpecs = getTextSpecsForImage(job, imageIndex);
      
      // Create editable text layers
      const textLayers = createTextLayers(width, height, textSpecs);
      
      console.log(`[PSD Token Download] Created ${textLayers.length} editable text layers`);

      // Create OPTIMIZED PSD document - only essential layers
      const psd = {
        width,
        height,
        channels: 3,
        bitsPerChannel: 8,
        colorMode: 3,
        children: [
          // Editable Text Group - at the top for easy access
          ...(textLayers.length > 0 ? [{
            name: 'Editable Text',
            opened: true,
            children: textLayers
          }] : []),
          // Single background layer (AI Edited image)
          {
            name: 'AI Edited Background',
            canvas: editedCanvas,
            blendMode: 'normal',
            opacity: 255
          }
        ]
      };

      // Generate PSD buffer with compression to reduce file size
      const psdArrayBuffer = writePsdBuffer(psd, { 
        invalidateTextLayers: true,
        generateThumbnail: false,  // Skip thumbnail to reduce size
        compression: 'rle'  // RLE compression
      });
      const psdBuffer = Buffer.from(psdArrayBuffer);

      console.log('[PSD Token Download] Optimized PSD created, size:', psdBuffer.length, 'bytes', '(' + Math.round(psdBuffer.length / 1024 / 1024) + ' MB)');

      // Send as downloadable file with proper headers for browser streaming
      const fileName = `${(imageData.originalName || `image_${imageIndex}`).replace(/\.[^/.]+$/, '')}_edited.psd`;
      
      res.setHeader('Content-Type', 'image/vnd.adobe.photoshop');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', psdBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.send(psdBuffer);

      console.log('[PSD Token Download] Sent to client:', fileName);

    } catch (error) {
      console.error('[PSD Token Download] Error:', error);
      res.status(500).json({
        error: 'Failed to generate PSD file',
        details: error.message
      });
    }
  }

  // Export SUPPORTS_TEXT_LAYERS constant for external use
  export { SUPPORTS_TEXT_LAYERS };

