import { uploadFileToDrive, makeFilePublic, getPublicImageUrl } from '../utils/googleDrive.js';
import { createJob, getJob, updateJob } from '../utils/jobStore.js';
import { editMultipleImages } from '../services/nanoBanana.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import OpenAI from 'openai';

const PDF_FOLDER_ID = '1oBX3lAfZQq9gt4fMhBe7JBh7aKo-k697';
const IMAGES_FOLDER_ID = '1_WUvTwPrw8DNpns9wB36cxQ13RamCvAS';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function extractPromptFromPDF(pdfBuffer) {
  try {
    // Convert PDF buffer to base64 for OpenAI
    const base64Pdf = pdfBuffer.toString('base64');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a PDF analysis assistant. Extract image editing specifications and return only the ai_prompt field as plain text.'
        },
        {
          role: 'user',
          content: `Extract the image editing instructions from this PDF and return ONLY the ai_prompt text (the description of how to edit the image). Do not include JSON, just the raw prompt text.

Example output format:
Add dark gradient from top (black) to middle (transparent). Overlay 'TITLE' in white Montserrat Extra Bold 48-60px, 'Subtitle text' below in Regular 18-22px. Add text shadow. Keep product unchanged.

PDF base64: ${base64Pdf.substring(0, 50000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const promptText = completion.choices[0].message.content.trim();
    
    if (!promptText || promptText.length < 10) {
      throw new Error('Could not extract valid prompt from PDF');
    }
    
    return promptText;
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

      console.log(`Uploaded ${file.originalname} to Drive, making public...`);
      await makeFilePublic(result.id);
      const publicUrl = getPublicImageUrl(result.id);
      console.log(`Image public URL: ${publicUrl}`);

      uploadedImages.push({
        id: result.id,
        name: file.originalname,
        originalName: file.originalname,
        driveId: result.id,
        publicUrl: publicUrl
      });
    }

    console.log(`Uploaded ${uploadedImages.length} images, starting processing...`);

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

  console.log(`Processing job ${jobId} - Images count: ${job.images?.length || 0}`);

  if (!job.promptText) {
    console.error('No prompt found for job:', jobId);
    updateJob(jobId, { 
      status: 'waiting_for_prompt',
      processingStep: 'Waiting for prompt or PDF brief'
    });
    return;
  }

  if (!job.images || job.images.length === 0) {
    console.error('No images found for job:', jobId);
    throw new Error('No images found for job');
  }

  console.log(`Processing ${job.images.length} images with prompt:`, job.promptText.substring(0, 100));

  updateJob(jobId, { 
    status: 'processing',
    processingStep: 'Editing images with AI'
  });

  const imageUrls = job.images.map(img => img.publicUrl);
  console.log('Image URLs to process:', imageUrls);
  
  console.log('Calling Nano Banana API...');
  const results = await editMultipleImages(imageUrls, job.promptText, {
    enableSyncMode: true,
    outputFormat: 'jpeg',
    numImages: 1,
    batchSize: 5
  });
  console.log(`Received ${results.length} results from API`);

  const editedImages = [];
  const EDITED_IMAGES_FOLDER = '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB';
  
  console.log(`Saving ${results.length} edited images to Drive...`);
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const originalImage = job.images[i];
    
    console.log(`Processing result ${i + 1}/${results.length}:`, result);
    
    // Fix: API returns data.outputs, not images
    if (result.data && result.data.outputs && result.data.outputs.length > 0) {
      const editedImageUrl = result.data.outputs[0];
      console.log(`Downloading edited image from: ${editedImageUrl}`);
      
      const imageResponse = await fetch(editedImageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      
      const originalNameWithoutExt = originalImage.originalName.replace(/\.[^/.]+$/, '');
      const editedFileName = `${originalNameWithoutExt}_edited.jpg`;
      
      console.log(`Uploading ${editedFileName} to Drive...`);
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
      console.log(`Saved edited image ${i + 1}/${results.length}: ${editedFileName}`);
      
      // Update progress
      updateJob(jobId, {
        processingStep: `Processed ${i + 1} of ${results.length} images`,
        progress: Math.round(((i + 1) / results.length) * 100)
      });
    } else {
      console.error(`No edited image in result ${i + 1} - Missing data.outputs`);
    }
  }

  console.log(`Successfully processed ${editedImages.length} images`);
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
