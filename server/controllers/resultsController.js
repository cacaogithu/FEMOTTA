export async function pollResults(req, res) {
  try {
    const { jobId } = req.params;
    
    res.json({ 
      status: 'processing',
      progress: 50,
      message: 'Images are being processed...'
    });
  } catch (error) {
    console.error('Poll error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
}

export async function downloadAll(req, res) {
  try {
    const { jobId } = req.params;
    
    res.json({ 
      success: true,
      message: 'Download prepared'
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to prepare download' });
  }
}
