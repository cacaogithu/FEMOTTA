import { GeminiImageService } from '../services/geminiService.js';
import { getBrandApiKeys } from '../utils/brandLoader.js';
import { createJob, getJob, updateJob } from '../utils/jobStore.js';

export async function createBatchJob(req, res) {
    try {
        const { requests, options } = req.body;
        // requests: [{ prompt, imageInput (base64/url), id }]

        if (!requests || !Array.isArray(requests) || requests.length === 0) {
            return res.status(400).json({ error: 'Invalid requests array' });
        }

        // Get brand config for API key
        // Assuming req.brand is populated by middleware
        const brandConfig = req.brand;

        if (!brandConfig.geminiApiKey) {
            return res.status(400).json({ error: 'Gemini API key not configured for this brand' });
        }

        const geminiService = new GeminiImageService(brandConfig.geminiApiKey);

        const batchJob = await geminiService.createBatchJob(requests, {
            modelName: options?.modelName || brandConfig.geminiImageModel || 'gemini-2.5-flash-image',
            displayName: options?.displayName || `batch_${Date.now()}`,
            aspectRatio: options?.aspectRatio,
            imageSize: options?.imageSize
        });

        // Store batch job info in our local job store or DB
        // For now, we'll just return the Gemini job info

        res.json({
            success: true,
            job: batchJob
        });

    } catch (error) {
        console.error('Batch creation error:', error);
        res.status(500).json({ error: 'Failed to create batch job', details: error.message });
    }
}

export async function getBatchStatus(req, res) {
    try {
        const { jobName } = req.params;
        const { brandId } = req.query; // Pass brand ID to look up key

        // We need the API key. In a real app, we'd look up the brand associated with this job.
        // For now, we'll assume the brand is passed or we look it up.
        // Let's assume req.brand is set by middleware if authenticated.

        const brandConfig = req.brand;
        if (!brandConfig || !brandConfig.geminiApiKey) {
            return res.status(400).json({ error: 'Brand context required' });
        }

        const geminiService = new GeminiImageService(brandConfig.geminiApiKey);
        const status = await geminiService.getBatchJobStatus(jobName);

        res.json(status);
    } catch (error) {
        console.error('Batch status error:', error);
        res.status(500).json({ error: 'Failed to get batch status', details: error.message });
    }
}

export async function getBatchResults(req, res) {
    try {
        const { outputUri } = req.query; // Pass output URI
        const brandConfig = req.brand;

        if (!brandConfig || !brandConfig.geminiApiKey) {
            return res.status(400).json({ error: 'Brand context required' });
        }

        const geminiService = new GeminiImageService(brandConfig.geminiApiKey);
        const results = await geminiService.getBatchResults(outputUri);

        res.json({ success: true, results });
    } catch (error) {
        console.error('Batch results error:', error);
        res.status(500).json({ error: 'Failed to get batch results', details: error.message });
    }
}
