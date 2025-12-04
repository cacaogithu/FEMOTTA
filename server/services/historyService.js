import { db } from '../db.js';
import { jobs, brands, images, editedImages } from '../../shared/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';
import { downloadFileFromDrive } from '../utils/googleDrive.js';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';

const STORAGE_BASE_PATH = './storage/history';

export async function ensureStorageDirectory(batchId) {
  const batchPath = path.join(STORAGE_BASE_PATH, batchId);
  const subDirs = ['input', 'variants', 'psd', 'metadata'];
  
  for (const subDir of subDirs) {
    const dirPath = path.join(batchPath, subDir);
    await fs.mkdir(dirPath, { recursive: true });
  }
  
  return batchPath;
}

export async function getHistoryList(brandId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  
  try {
    const completedJobs = await db
      .select({
        id: jobs.id,
        jobId: jobs.jobId,
        brandId: jobs.brandId,
        status: jobs.status,
        briefText: jobs.briefText,
        promptText: jobs.promptText,
        imageSpecs: jobs.imageSpecs,
        imagesData: jobs.imagesData,
        editedImagesData: jobs.editedImagesData,
        startTime: jobs.startTime,
        endTime: jobs.endTime,
        processingTimeSeconds: jobs.processingTimeSeconds,
        estimatedManualTimeMinutes: jobs.estimatedManualTimeMinutes,
        createdAt: jobs.createdAt
      })
      .from(jobs)
      .where(and(
        eq(jobs.brandId, brandId),
        eq(jobs.status, 'completed')
      ))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);
    
    const countResult = await db
      .select({ count: sql`count(*)::int` })
      .from(jobs)
      .where(and(
        eq(jobs.brandId, brandId),
        eq(jobs.status, 'completed')
      ));
    
    const totalCount = countResult[0]?.count || 0;
    
    const historyItems = completedJobs.map(job => {
      const inputImages = job.imagesData || [];
      const editedImages = job.editedImagesData || [];
      const firstEditedImage = editedImages[0];
      
      return {
        id: job.jobId,
        dbId: job.id,
        status: job.status,
        promptSnippet: (job.promptText || job.briefText || '').substring(0, 100) + '...',
        fullPrompt: job.promptText || job.briefText,
        inputCount: inputImages.length,
        outputCount: editedImages.length,
        thumbnailUrl: firstEditedImage?.url || firstEditedImage?.editedPublicUrl || null,
        startTime: job.startTime,
        endTime: job.endTime,
        processingTimeSeconds: job.processingTimeSeconds,
        timeSavedMinutes: job.estimatedManualTimeMinutes,
        createdAt: job.createdAt,
        marketplacePreset: job.imageSpecs?.[0]?.marketplacePreset || 'default'
      };
    });
    
    return {
      items: historyItems,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + completedJobs.length < totalCount
      }
    };
  } catch (error) {
    console.error('[HistoryService] Error fetching history list:', error);
    throw error;
  }
}

export async function getBatchDetails(jobId, brandId) {
  try {
    const jobResult = await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.jobId, jobId),
        eq(jobs.brandId, brandId)
      ))
      .limit(1);
    
    if (jobResult.length === 0) {
      return null;
    }
    
    const job = jobResult[0];
    const inputImages = job.imagesData || [];
    const editedImagesData = job.editedImagesData || [];
    const imageSpecsData = job.imageSpecs || [];
    
    const variants = editedImagesData.map((edited, index) => {
      const spec = imageSpecsData[index % imageSpecsData.length] || {};
      const original = inputImages[index] || {};
      
      return {
        index,
        originalName: edited.originalName || original.originalName,
        originalUrl: original.publicUrl,
        originalDriveId: original.driveId,
        editedName: edited.name,
        editedUrl: edited.url || edited.editedPublicUrl,
        editedDriveId: edited.editedImageId || edited.id,
        title: spec.title || edited.title,
        subtitle: spec.subtitle || edited.subtitle,
        promptUsed: spec.ai_prompt || edited.promptUsed
      };
    });
    
    return {
      id: job.jobId,
      dbId: job.id,
      brandId: job.brandId,
      status: job.status,
      
      briefText: job.briefText,
      promptText: job.promptText,
      
      inputImages: inputImages.map(img => ({
        name: img.originalName || img.name,
        url: img.publicUrl,
        driveId: img.driveId || img.id
      })),
      
      variants,
      
      imageSpecs: imageSpecsData,
      
      timestamps: {
        created: job.createdAt,
        started: job.startTime,
        completed: job.endTime
      },
      
      metrics: {
        processingTimeSeconds: job.processingTimeSeconds,
        estimatedManualTimeMinutes: job.estimatedManualTimeMinutes,
        inputCount: inputImages.length,
        outputCount: editedImagesData.length
      },
      
      hasPsd: editedImagesData.length > 0,
      
      localStoragePath: path.join(STORAGE_BASE_PATH, job.jobId)
    };
  } catch (error) {
    console.error('[HistoryService] Error fetching batch details:', error);
    throw error;
  }
}

export async function archiveBatchToStorage(jobId, jobData) {
  try {
    const batchPath = await ensureStorageDirectory(jobId);
    
    const metadata = {
      jobId,
      brandId: jobData.brandId,
      brandSlug: jobData.brandSlug,
      archivedAt: new Date().toISOString(),
      
      briefText: jobData.briefText,
      promptText: jobData.promptText,
      
      inputImages: jobData.images?.map(img => ({
        name: img.originalName,
        driveId: img.driveId,
        publicUrl: img.publicUrl
      })) || [],
      
      editedImages: jobData.editedImages?.map(img => ({
        name: img.name,
        driveId: img.editedImageId || img.id,
        publicUrl: img.url,
        title: img.title,
        subtitle: img.subtitle,
        promptUsed: img.promptUsed
      })) || [],
      
      imageSpecs: jobData.imageSpecs || [],
      
      timestamps: {
        created: jobData.createdAt,
        started: jobData.startTime,
        completed: new Date().toISOString()
      },
      
      metrics: {
        processingTimeSeconds: jobData.processingTimeSeconds,
        estimatedManualTimeMinutes: jobData.estimatedManualTimeMinutes,
        timeSavedMinutes: jobData.timeSavedMinutes
      },
      
      marketplacePreset: jobData.marketplacePreset,
      driveDestinationFolderId: jobData.driveDestinationFolderId
    };
    
    const metadataPath = path.join(batchPath, 'metadata', 'batch-info.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`[HistoryService] Archived batch ${jobId} to ${batchPath}`);
    
    return {
      success: true,
      storagePath: batchPath,
      metadataPath
    };
  } catch (error) {
    console.error('[HistoryService] Error archiving batch:', error);
    throw error;
  }
}

export async function createBatchZip(jobId, brandId, includeOriginals = true, includePsd = false) {
  const batchDetails = await getBatchDetails(jobId, brandId);
  
  if (!batchDetails) {
    throw new Error('Batch not found');
  }
  
  const zipPath = path.join(STORAGE_BASE_PATH, jobId, `${jobId}_download.zip`);
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  
  return new Promise(async (resolve, reject) => {
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 5 } });
    
    output.on('close', () => {
      console.log(`[HistoryService] Created ZIP: ${zipPath} (${archive.pointer()} bytes)`);
      resolve(zipPath);
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    for (const variant of batchDetails.variants) {
      if (variant.editedDriveId) {
        try {
          const buffer = await downloadFileFromDrive(variant.editedDriveId);
          archive.append(buffer, { name: `edited/${variant.editedName}` });
        } catch (err) {
          console.warn(`[HistoryService] Could not download edited image ${variant.editedDriveId}:`, err.message);
        }
      }
      
      if (includeOriginals && variant.originalDriveId) {
        try {
          const buffer = await downloadFileFromDrive(variant.originalDriveId);
          archive.append(buffer, { name: `originals/${variant.originalName}` });
        } catch (err) {
          console.warn(`[HistoryService] Could not download original image ${variant.originalDriveId}:`, err.message);
        }
      }
    }
    
    const metadataJson = JSON.stringify({
      jobId,
      downloadedAt: new Date().toISOString(),
      prompt: batchDetails.promptText,
      variants: batchDetails.variants.map(v => ({
        original: v.originalName,
        edited: v.editedName,
        title: v.title,
        subtitle: v.subtitle
      })),
      metrics: batchDetails.metrics
    }, null, 2);
    
    archive.append(metadataJson, { name: 'batch-metadata.json' });
    
    await archive.finalize();
  });
}

export async function downloadSingleImage(jobId, brandId, imageIndex, type = 'edited') {
  const batchDetails = await getBatchDetails(jobId, brandId);
  
  if (!batchDetails) {
    throw new Error('Batch not found');
  }
  
  if (imageIndex < 0 || imageIndex >= batchDetails.variants.length) {
    throw new Error('Invalid image index');
  }
  
  const variant = batchDetails.variants[imageIndex];
  const driveId = type === 'edited' ? variant.editedDriveId : variant.originalDriveId;
  const fileName = type === 'edited' ? variant.editedName : variant.originalName;
  
  if (!driveId) {
    throw new Error(`${type} image not available`);
  }
  
  const buffer = await downloadFileFromDrive(driveId);
  
  return {
    buffer,
    fileName,
    mimeType: 'image/jpeg'
  };
}
