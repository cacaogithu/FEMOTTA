export async function uploadPDF(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const jobId = `job_${Date.now()}`;
    
    res.json({ 
      success: true, 
      jobId,
      message: 'PDF uploaded successfully' 
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({ error: 'Failed to upload PDF' });
  }
}

export async function uploadImages(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    res.json({ 
      success: true, 
      count: req.files.length,
      message: 'Images uploaded successfully' 
    });
  } catch (error) {
    console.error('Images upload error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
}
