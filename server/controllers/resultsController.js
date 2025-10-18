import { listFilesInFolder, downloadFileFromDrive } from '../utils/googleDrive.js';
import { getJob, updateJob } from '../utils/jobStore.js';
import archiver from 'archiver';

const CORSAIR_FOLDER_ID = '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB';

export async function pollResults(req, res) {
  try {
    const { jobId } = req.params;
    
    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'failed') {
      return res.json({
        status: 'failed',
        error: job.error || 'Processing failed'
      });
    }

    if (job.status === 'processing') {
      return res.json({ 
        status: 'processing',
        step: 3,
        totalSteps: 5,
        message: job.processingStep || 'Editing images with AI...',
        progress: job.progress || 0,
        workflowSteps: job.workflowSteps || [],
        currentImageIndex: job.currentImageIndex
      });
    }

    if (job.status === 'completed' && job.editedImages) {
      return res.json({ 
        status: 'completed',
        jobId: jobId,
        images: job.editedImages,
        workflowSteps: job.workflowSteps || []
      });
    }

    return res.json({ 
      status: 'processing',
      step: 1,
      totalSteps: 5,
      message: 'Initializing...',
      workflowSteps: job.workflowSteps || []
    });

  } catch (error) {
    console.error('Poll error:', error);
    res.status(500).json({ error: 'Failed to check status', details: error.message });
  }
}

export async function downloadAll(req, res) {
  try {
    const { jobId } = req.params;
    
    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.editedImages || job.editedImages.length === 0) {
      return res.status(404).json({ error: 'No edited images found' });
    }
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=edited-images.zip');

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.pipe(res);

    for (const image of job.editedImages) {
      const fileData = await downloadFileFromDrive(image.editedImageId);
      archive.append(Buffer.from(fileData), { name: image.name });
    }

    await archive.finalize();
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to prepare download', details: error.message });
  }
}
