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

    const files = await listFilesInFolder(CORSAIR_FOLDER_ID);
    
    const newImagesFolders = files.filter(f => 
      f.mimeType === 'application/vnd.google-apps.folder' && 
      f.name === 'New Images'
    );

    if (newImagesFolders.length === 0) {
      return res.json({ 
        status: 'processing',
        step: 2,
        totalSteps: 5,
        message: 'AI is parsing your creative brief...'
      });
    }

    const latestFolder = newImagesFolders[0];
    const resultFiles = await listFilesInFolder(latestFolder.id);

    if (resultFiles.length === 0 || resultFiles.length < job.imageCount) {
      return res.json({ 
        status: 'processing',
        step: 4,
        totalSteps: 5,
        message: 'Editing images with AI...',
        progress: Math.floor((resultFiles.length / job.imageCount) * 100)
      });
    }

    updateJob(jobId, { resultFolderId: latestFolder.id });

    const imageComparisons = resultFiles.map(editedFile => {
      const originalName = editedFile.name.replace('_edited', '').replace('.jpg', '').replace('.jpeg', '').replace('.png', '');
      const originalImage = job.images.find(img => 
        img.originalName.toLowerCase().includes(originalName.toLowerCase()) ||
        originalName.toLowerCase().includes(img.originalName.toLowerCase().replace(/\.[^/.]+$/, ''))
      );

      return {
        id: editedFile.id,
        name: editedFile.name,
        editedImageId: editedFile.id,
        originalImageId: originalImage?.driveId,
        modifiedTime: editedFile.modifiedTime
      };
    });

    res.json({ 
      status: 'completed',
      folderId: latestFolder.id,
      jobId: jobId,
      images: imageComparisons
    });
  } catch (error) {
    console.error('Poll error:', error);
    res.status(500).json({ error: 'Failed to check status', details: error.message });
  }
}

export async function downloadAll(req, res) {
  try {
    const { folderId } = req.params;
    
    const files = await listFilesInFolder(folderId);
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=edited-images.zip');

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.pipe(res);

    for (const file of files) {
      if (file.mimeType.startsWith('image/')) {
        const fileData = await downloadFileFromDrive(file.id);
        archive.append(Buffer.from(fileData), { name: file.name });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to prepare download', details: error.message });
  }
}
