import { uploadFileToDrive, makeFilePublic, getPublicImageUrl } from '../utils/googleDrive.js';
import { createJob, getJob, updateJob } from '../utils/jobStore.js';
import { editMultipleImages } from '../services/nanoBanana.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PDF_FOLDER_ID = '1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697';
const IMAGES_FOLDER_ID = '1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS';

async function extractPromptFromPDF(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    const pdfText = data.text;

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY not found in environment variables');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Extract image specifications from the PDF as JSON array.

For each image, return:
{
  "image_number": 1,
  "variant": "METAL DARK" | "WOOD DARK",
  "title": "UPPERCASE HEADLINE",
  "subtitle": "Copy text",
  "asset": "filename",
  "ai_prompt": "Add dark gradient from top (black) to middle (transparent). Overlay '{title}' in white Montserrat Extra Bold 48-60px, '{subtitle}' below in Regular 18-22px. Add text shadow. Keep product unchanged."
}

Return only valid JSON array.

## Input

${pdfText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[0]);
      if (parsedData.length > 0 && parsedData[0].ai_prompt) {
        return parsedData[0].ai_prompt;
      }
    }
    
    throw new Error('Could not extract prompt from LLM response');
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
}

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
      'application/pdf',
      PDF_FOLDER_ID
    );

    console.log('Extracting prompt from PDF...');
    const promptText = await extractPromptFromPDF(req.file.buffer);
    console.log('Prompt extracted:', promptText);

    createJob({
      id: jobId,
      pdfId: result.id,
      pdfName: result.name,
      promptText: promptText,
      images: [],
      status: 'pdf_uploaded',
      createdAt: new Date()
    });

    res.json({ 
      success: true, 
      jobId,
      fileId: result.id,
      fileName: result.name,
      promptText: promptText,
      message: 'PDF uploaded and prompt extracted successfully' 
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
        file.mimetype,
        IMAGES_FOLDER_ID
      );

      await makeFilePublic(result.id);
      const publicUrl = getPublicImageUrl(result.id);

      uploadedImages.push({
        id: result.id,
        name: file.originalname,
        originalName: file.originalname,
        driveId: result.id,
        publicUrl: publicUrl,
        buffer: file.buffer
      });
    }

    updateJob(jobId, {
      images: uploadedImages,
      status: 'processing',
      imageCount: uploadedImages.length
    });

    res.json({ 
      success: true, 
      count: uploadedImages.length,
      images: uploadedImages,
      message: 'Images uploaded successfully, processing started' 
    });

    processImagesWithNanoBanana(jobId).catch(err => {
      console.error('Background processing error:', err);
      updateJob(jobId, { 
        status: 'failed',
        error: err.message
      });
    });

  } catch (error) {
    console.error('Images upload error:', error);
    res.status(500).json({ error: 'Failed to upload images', details: error.message });
  }
}

async function processImagesWithNanoBanana(jobId) {
  const job = getJob(jobId);
  
  if (!job) {
    throw new Error('Job not found');
  }

  if (!job.promptText) {
    console.error('No prompt found for job:', jobId);
    updateJob(jobId, { 
      status: 'waiting_for_prompt',
      processingStep: 'Waiting for prompt or PDF brief'
    });
    return;
  }

  if (!job.images || job.images.length === 0) {
    throw new Error('No images found for job');
  }

  updateJob(jobId, { 
    status: 'processing',
    processingStep: 'Editing images with AI'
  });

  const imageUrls = job.images.map(img => img.publicUrl);
  
  const results = await editMultipleImages(imageUrls, job.promptText, {
    enableSyncMode: true,
    outputFormat: 'jpeg',
    numImages: 1
  });

  const editedImages = [];
  const EDITED_IMAGES_FOLDER = '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB';
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const originalImage = job.images[i];
    
    if (result.images && result.images.length > 0) {
      const editedImageUrl = result.images[0].url;
      
      const imageResponse = await fetch(editedImageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      
      const originalNameWithoutExt = originalImage.originalName.replace(/\.[^/.]+$/, '');
      const editedFileName = `${originalNameWithoutExt}_edited.jpg`;
      
      const uploadedFile = await uploadFileToDrive(
        Buffer.from(imageBuffer),
        editedFileName,
        'image/jpeg',
        EDITED_IMAGES_FOLDER
      );

      await makeFilePublic(uploadedFile.id);

      editedImages.push({
        id: uploadedFile.id,
        name: editedFileName,
        editedImageId: uploadedFile.id,
        originalImageId: originalImage.driveId,
        originalName: originalImage.originalName,
        url: getPublicImageUrl(uploadedFile.id)
      });
    }
  }

  updateJob(jobId, { 
    status: 'completed',
    editedImages,
    processingStep: 'Complete'
  });
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
      'text/plain',
      PDF_FOLDER_ID
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
