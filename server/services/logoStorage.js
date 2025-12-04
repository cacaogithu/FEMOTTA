import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGOS_DIR = path.join(__dirname, '../../assets/logos');

if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function saveLogoFromBase64(base64Data, logoName) {
  try {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    const metadata = await sharp(buffer).metadata();
    const aspectRatio = metadata.width / metadata.height;
    
    if (aspectRatio > 3) {
      console.log(`[LogoStorage] Warning: "${logoName}" is a wide banner (${aspectRatio.toFixed(1)}:1) - may not be ideal for overlay`);
    }
    
    const filename = `${sanitizeFilename(logoName)}.png`;
    const filepath = path.join(LOGOS_DIR, filename);
    
    await sharp(buffer)
      .png()
      .toFile(filepath);
    
    console.log(`[LogoStorage] Saved logo "${logoName}" to ${filepath}`);
    
    return {
      localPath: `assets/logos/${filename}`,
      url: `/assets/logos/${filename}`,
      dimensions: { width: metadata.width, height: metadata.height },
      aspectRatio
    };
  } catch (error) {
    console.error(`[LogoStorage] Failed to save logo "${logoName}":`, error.message);
    return null;
  }
}

export async function getLogoAsBuffer(localPath) {
  try {
    const fullPath = path.join(__dirname, '../..', localPath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`[LogoStorage] Logo not found at ${fullPath}`);
      return null;
    }
    
    return fs.readFileSync(fullPath);
  } catch (error) {
    console.error(`[LogoStorage] Failed to read logo:`, error.message);
    return null;
  }
}

export async function getLogoAsBase64(localPath) {
  const buffer = await getLogoAsBuffer(localPath);
  if (!buffer) return null;
  
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

export function listSavedLogos() {
  try {
    const files = fs.readdirSync(LOGOS_DIR);
    return files
      .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
      .map(f => ({
        filename: f,
        localPath: `assets/logos/${f}`,
        url: `/assets/logos/${f}`
      }));
  } catch (error) {
    console.error('[LogoStorage] Failed to list logos:', error.message);
    return [];
  }
}

export default {
  saveLogoFromBase64,
  getLogoAsBuffer,
  getLogoAsBase64,
  listSavedLogos
};
