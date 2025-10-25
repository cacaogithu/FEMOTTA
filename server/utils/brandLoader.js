import { brandService } from '../services/brandService.js';

// Helper to load brand configuration for a job
export async function loadBrandForJob(job) {
  if (!job || !job.brandId) {
    // Fallback to Corsair for backwards compatibility
    return await brandService.getBrandBySlug('corsair');
  }
  
  return await brandService.getBrandById(job.brandId);
}

// Helper to get API keys for a job without exposing them
export async function getBrandApiKeys(job) {
  const brand = await loadBrandForJob(job);
  
  return {
    wavespeedApiKey: brand.wavespeedApiKey || process.env.WAVESPEED_API_KEY,
    openaiApiKey: brand.openaiApiKey || process.env.OPENAI_API_KEY,
    editedResultsFolderId: brand.editedResultsFolderId || '17NE_igWpmMIbyB9H7G8DZ8ZVdzNBMHoB' // Corsair fallback
  };
}
