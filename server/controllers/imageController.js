import { downloadFileFromDrive } from '../utils/googleDrive.js';

export async function downloadImage(req, res) {
  try {
    const { fileId } = req.params;
    
    const imageData = await downloadFileFromDrive(fileId);
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(Buffer.from(imageData));
  } catch (error) {
    console.error('Image download error:', error);
    res.status(500).json({ error: 'Failed to download image', details: error.message });
  }
}
