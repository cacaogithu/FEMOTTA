
/**
 * Nano Banana Pro Service
 * Handles image editing using Wavespeed's Nano Banana Pro model
 */

export class NanoBananaProService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.WAVESPEED_API_KEY;
    this.baseUrl = 'https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit';
  }

  async editImage(imageUrl, prompt, options = {}) {
    const {
      enableBase64Output = false,
      enableSyncMode = true,
      outputFormat = 'jpeg',
      numberOfImages = 1
    } = options;

    const payload = {
      enable_base64_output: enableBase64Output,
      enable_sync_mode: enableSyncMode,
      images: [imageUrl],
      output_format: outputFormat,
      prompt: prompt,
      number_of_images: numberOfImages
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Nano Banana Pro API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (enableSyncMode) {
        return result.output_images || result.images;
      } else {
        return {
          jobId: result.job_id,
          statusUrl: result.status_url
        };
      }
    } catch (error) {
      console.error('[Nano Banana Pro] Error:', error);
      throw error;
    }
  }

  async getJobStatus(jobId) {
    const statusUrl = `https://api.wavespeed.ai/api/v3/jobs/${jobId}`;
    
    const response = await fetch(statusUrl, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    return response.json();
  }
}
