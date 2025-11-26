            import fetch from 'node-fetch';
            import pLimit from 'p-limit';

            const NANO_BANANA_EDIT_URL = 'https://api.wavespeed.ai/api/v3/google/nano-banana/edit';
            const NANO_BANANA_RESULT_URL = 'https://api.wavespeed.ai/api/v3/predictions';

            export class NanoBananaService {
              constructor(apiKey) {
                this.apiKey = apiKey || process.env.WAVESPEED_API_KEY;
                if (!this.apiKey) {
                  console.warn('Wavespeed API key is missing. Nano Banana service will not function correctly.');
                }
              }

              async editImage(imageUrlOrBase64, prompt, options = {}) {
                const {
                  enableSyncMode = true,
                  outputFormat = 'jpeg',
                  enableBase64Output = false,
                  numImages = 1,
                  isBase64 = false,
                  retries = 3
                } = options;

                const imageInput = imageUrlOrBase64;

                const payload = {
                  enable_base64_output: enableBase64Output,
                  enable_sync_mode: enableSyncMode,
                  images: [imageInput],
                  output_format: outputFormat,
                  prompt: prompt,
                  num_images: numImages
                };

                let lastError;
                for (let attempt = 1; attempt <= retries; attempt++) {
                  try {
                    const response = await fetch(NANO_BANANA_EDIT_URL, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                      },
                      body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                      const errorText = await response.text();
                      // Don't retry on client errors (4xx) except maybe 429 (Too Many Requests)
                      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                        throw new Error(`Nano Banana API error: ${response.status} - ${errorText}`);
                      }
                      throw new Error(`Nano Banana API error: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();

                    if (enableSyncMode) {
                      return result;
                    } else {
                      return { requestId: result.requestId };
                    }
                  } catch (error) {
                    console.error(`Nano Banana edit attempt ${attempt} failed:`, error);
                    lastError = error;

                    if (error.message.includes('INSUFFICIENT_CREDITS')) {
                      throw new Error('INSUFFICIENT_CREDITS: The Wavespeed API account needs to be topped up with credits.');
                    }

                    if (attempt < retries) {
                      // Exponential backoff
                      const delay = Math.pow(2, attempt) * 1000;
                      await new Promise(resolve => setTimeout(resolve, delay));
                    }
                  }
                }
                throw lastError;
              }

              async editMultipleImages(imageUrls, prompt, options = {}) {
                const concurrency = options.concurrency || 5; // Default to 5 concurrent requests
                const limit = pLimit(concurrency);
                const progressCallback = options.onProgress || (() => { });

                const totalImages = imageUrls.length;
                let completedCount = 0;

                const tasks = imageUrls.map((imageUrl, index) => {
                  return limit(async () => {
                    try {
                      const result = await this.editImage(imageUrl, prompt, options);
                      completedCount++;
                      progressCallback({
                        type: 'image_complete',
                        imageIndex: index,
                        totalImages,
                        imageName: `Image ${index + 1}`,
                        progress: Math.round((completedCount / totalImages) * 100)
                      });
                      return result;
                    } catch (error) {
                      console.error(`Failed to process image ${index}:`, error);
                      // Return error object instead of throwing to allow other items to finish
                      return { error: error.message, imageIndex: index };
                    }
                  });
                });

                return Promise.all(tasks);
              }

              async pollResult(requestId) {
                try {
                  const response = await fetch(`${NANO_BANANA_RESULT_URL}/${requestId}/result`, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${this.apiKey}`
                    }
                  });

                  if (!response.ok) {
                    if (response.status === 404 || response.status === 202) {
                      return { status: 'processing' };
                    }
                    throw new Error(`Failed to get result: ${response.status}`);
                  }

                  const result = await response.json();
                  return { status: 'completed', data: result };
                } catch (error) {
                  console.error('Poll result error:', error);
                  throw error;
                }
              }
            }

            // Export standalone functions for backward compatibility if needed, 
            // but encouraged to use the class.
            const defaultService = new NanoBananaService();

            export async function editImageWithNanoBanana(imageUrlOrBase64, prompt, options = {}) {
              // Allow overriding API key in options for backward compat
              const service = options.wavespeedApiKey ? new NanoBananaService(options.wavespeedApiKey) : defaultService;
              return service.editImage(imageUrlOrBase64, prompt, options);
            }

            export async function editMultipleImages(imageUrls, prompt, options = {}) {
              const service = options.wavespeedApiKey ? new NanoBananaService(options.wavespeedApiKey) : defaultService;
              return service.editMultipleImages(imageUrls, prompt, options);
            }

            export async function pollNanoBananaResult(requestId) {
              return defaultService.pollResult(requestId);
            }

            export async function reEditImage(originalImageUrl, editedImageUrl, newPrompt, options = {}) {
              return editImageWithNanoBanana(editedImageUrl || originalImageUrl, newPrompt, options);
            }
