import { createCanvas, registerFont, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  
  try {
    const fontsDir = path.join(__dirname, '../fonts');
    registerFont(path.join(fontsDir, 'Saira-Bold-Static.ttf'), { family: 'Saira', weight: 'bold' });
    registerFont(path.join(fontsDir, 'Saira-Regular.ttf'), { family: 'Saira', weight: 'normal' });
    fontsRegistered = true;
    console.log('[CanvasOverlay] Fonts registered successfully');
  } catch (error) {
    console.error('[CanvasOverlay] Error registering fonts:', error);
  }
}

async function fetchImageBuffer(imageUrl) {
  if (imageUrl.startsWith('data:')) {
    const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      return Buffer.from(matches[2], 'base64');
    }
    throw new Error('Invalid data URL format');
  }
  
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

export async function overlayTextOnImage(imageUrl, options = {}) {
  registerFonts();
  
  const {
    title = '',
    subtitle = '',
    marginTop = 5,
    marginLeft = 4,
    gradientCoverage = 20,
    gradientOpacity = 0.35,
    titleFontSize = null,
    textAlignment = 'left',
    logoBase64 = null,
    logoPosition = 'bottom-left'
  } = options;

  console.log(`[CanvasOverlay] Processing image with title: "${title}"`);
  
  const imageBuffer = await fetchImageBuffer(imageUrl);
  const image = await loadImage(imageBuffer);
  
  const width = image.width;
  const height = image.height;
  
  console.log(`[CanvasOverlay] Image dimensions: ${width}x${height}`);
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(image, 0, 0);
  
  const gradientHeight = Math.round(height * (gradientCoverage / 100));
  const gradient = ctx.createLinearGradient(0, 0, 0, gradientHeight);
  gradient.addColorStop(0, `rgba(20, 20, 20, ${gradientOpacity})`);
  gradient.addColorStop(1, 'rgba(20, 20, 20, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, gradientHeight);
  
  const calculatedTitleFontSize = titleFontSize || Math.round(Math.min(width, height) * 0.06);
  const subtitleFontSize = Math.round(calculatedTitleFontSize * 0.4);
  
  const marginTopPx = Math.round(height * (marginTop / 100));
  const marginLeftPx = Math.round(width * (marginLeft / 100));
  const maxTextWidth = width * 0.85;
  
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1.5;
  
  if (title) {
    ctx.font = `bold ${calculatedTitleFontSize}px Saira`;
    ctx.fillStyle = '#FFFFFF';
    
    let xPos;
    if (textAlignment === 'center') {
      ctx.textAlign = 'center';
      xPos = width / 2;
    } else if (textAlignment === 'right') {
      ctx.textAlign = 'right';
      xPos = width - marginLeftPx;
    } else {
      ctx.textAlign = 'left';
      xPos = marginLeftPx;
    }
    
    const titleLines = wrapText(ctx, title.toUpperCase(), maxTextWidth);
    const lineHeight = calculatedTitleFontSize * 1.1;
    
    let yPos = marginTopPx + calculatedTitleFontSize;
    
    for (const line of titleLines) {
      ctx.fillText(line, xPos, yPos);
      yPos += lineHeight;
    }
    
    if (subtitle) {
      yPos += 8;
      
      ctx.font = `normal ${subtitleFontSize}px Saira`;
      
      const subtitleLines = wrapText(ctx, subtitle, maxTextWidth);
      const subtitleLineHeight = subtitleFontSize * 1.3;
      
      for (const line of subtitleLines) {
        ctx.fillText(line, xPos, yPos);
        yPos += subtitleLineHeight;
      }
    }
  }
  
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  if (logoBase64) {
    try {
      const logoBuffer = Buffer.from(logoBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const logoImage = await loadImage(logoBuffer);
      
      const maxLogoHeight = height * 0.08;
      const logoScale = maxLogoHeight / logoImage.height;
      const logoWidth = logoImage.width * logoScale;
      const logoHeight = maxLogoHeight;
      
      let logoX, logoY;
      const logoPadding = Math.round(width * 0.03);
      
      if (logoPosition === 'bottom-right') {
        logoX = width - logoWidth - logoPadding;
        logoY = height - logoHeight - logoPadding;
      } else {
        logoX = logoPadding;
        logoY = height - logoHeight - logoPadding;
      }
      
      ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
      console.log(`[CanvasOverlay] Logo added at position: ${logoPosition}`);
    } catch (logoError) {
      console.error('[CanvasOverlay] Error adding logo:', logoError.message);
    }
  }
  
  const outputBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  const base64Output = outputBuffer.toString('base64');
  
  console.log(`[CanvasOverlay] Output image size: ${Math.round(outputBuffer.length / 1024)}KB`);
  
  return {
    base64: base64Output,
    mimeType: 'image/jpeg',
    dataUrl: `data:image/jpeg;base64,${base64Output}`,
    width,
    height
  };
}

export async function processMultipleImagesWithOverlay(images, options = {}) {
  const results = [];
  
  for (let i = 0; i < images.length; i++) {
    const imageData = images[i];
    
    console.log(`[CanvasOverlay] Processing image ${i + 1}/${images.length}`);
    
    try {
      const result = await overlayTextOnImage(imageData.url, {
        title: imageData.title || '',
        subtitle: imageData.subtitle || '',
        marginTop: imageData.marginTop || options.marginTop || 5,
        marginLeft: imageData.marginLeft || options.marginLeft || 4,
        gradientCoverage: imageData.gradientCoverage || options.gradientCoverage || 20,
        gradientOpacity: imageData.gradientOpacity || options.gradientOpacity || 0.35,
        titleFontSize: imageData.titleFontSize || options.titleFontSize || null,
        textAlignment: imageData.textAlignment || options.textAlignment || 'left',
        logoBase64: imageData.logoBase64 || options.logoBase64 || null,
        logoPosition: imageData.logoPosition || options.logoPosition || 'bottom-left'
      });
      
      results.push({
        success: true,
        imageIndex: i,
        ...result
      });
      
      if (options.onProgress) {
        options.onProgress({
          type: 'image_complete',
          imageIndex: i,
          totalImages: images.length,
          progress: Math.round(((i + 1) / images.length) * 100)
        });
      }
    } catch (error) {
      console.error(`[CanvasOverlay] Error processing image ${i + 1}:`, error.message);
      results.push({
        success: false,
        imageIndex: i,
        error: error.message
      });
    }
  }
  
  return results;
}

export default {
  overlayTextOnImage,
  processMultipleImagesWithOverlay
};
