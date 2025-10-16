import { uploadFileToDrive } from '../utils/googleDrive.js';
import { createJob, getJob, updateJob } from '../utils/jobStore.js';

const PDF_FOLDER_ID = '1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697';
const IMAGES_FOLDER_ID = '1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS';

export async function uploadPDF(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'File must be a PDF' });
    }

    const jobId = `job_${Date.now()}`;
    const fileName = `brief-${Date.now()}.pdf`;

    const result = await uploadFileToDrive(
      req.file.buffer,
      fileName,
      PDF_FOLDER_ID,
      'application/pdf'
    );

    createJob({
      id: jobId,
      pdfId: result.id,
      pdfName: result.name,
      images: [],
      status: 'pdf_uploaded',
      createdAt: new Date()
    });

    res.json({ 
      success: true, 
      jobId,
      fileId: result.id,
      fileName: result.name,
      message: 'PDF uploaded successfully' 
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({ error: 'Failed to upload PDF', details: error.message });
  }
}

export async function uploadImages(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const { jobId } = req.body;
    
    const job = getJob(jobId);
    if (!jobId || !job) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const uploadedImages = [];

    for (const file of req.files) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.mimetype)) {
        continue;
      }

      const result = await uploadFileToDrive(
        file.buffer,
        file.originalname,
        IMAGES_FOLDER_ID,
        file.mimetype
      );

      uploadedImages.push({
        id: result.id,
        name: file.originalname,
        originalName: file.originalname,
        driveId: result.id,
        buffer: file.buffer
      });
    }

    updateJob(jobId, {
      images: uploadedImages,
      status: 'images_uploaded',
      imageCount: uploadedImages.length
    });

    res.json({ 
      success: true, 
      count: uploadedImages.length,
      images: uploadedImages,
      message: 'Images uploaded successfully' 
    });
  } catch (error) {
    console.error('Images upload error:', error);
    res.status(500).json({ error: 'Failed to upload images', details: error.message });
  }
}

export async function uploadTextPrompt(req, res) {
  try {
    const { prompt } = req.body;
    
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const jobId = `job_${Date.now()}`;
    const fileName = `prompt-${Date.now()}.txt`;

    const promptBuffer = Buffer.from(prompt, 'utf-8');
    
    const result = await uploadFileToDrive(
      promptBuffer,
      fileName,
      PDF_FOLDER_ID,
      'text/plain'
    );

    createJob({
      id: jobId,
      promptId: result.id,
      promptText: prompt,
      images: [],
      status: 'prompt_uploaded',
      createdAt: new Date()
    });

    res.json({ 
      success: true, 
      jobId,
      fileId: result.id,
      fileName: result.name,
      message: 'Prompt uploaded successfully' 
    });
  } catch (error) {
    console.error('Prompt upload error:', error);
    res.status(500).json({ error: 'Failed to upload prompt', details: error.message });
  }
}

export function getJobInfo(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
}
