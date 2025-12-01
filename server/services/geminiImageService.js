import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GeminiImageService {
    constructor(apiKey) {
        if (!apiKey) {
            console.warn('Gemini API key is missing. GeminiImageService will not function.');
            this.genAI = null;
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }

        // Default model for image generation/editing (using Gemini 2.0)
        this.defaultModel = 'gemini-2.0-flash-exp';
        this.flashModel = 'gemini-2.0-flash-exp';
    }

    /**
     * Generate an image from a text prompt
     * @param {string} prompt - The text description for the image
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} - Result containing image data or url
     */
    async generateImage(prompt, options = {}) {
        if (!this.genAI) throw new Error('Gemini API key is not configured.');

        const {
            modelName = this.defaultModel,
            aspectRatio = '1:1',
            imageSize = '2K', // '1K' or '2K' (4K supported on some models)
            numImages = 1,
            safetySettings,
            negativePrompt
        } = options;

        try {
            const model = this.genAI.getGenerativeModel({ model: modelName });

            const generationConfig = {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio,
                    imageSize
                }
            };

            if (numImages > 1) {
                generationConfig.candidateCount = numImages;
            }

            // Construct prompt parts
            const parts = [{ text: prompt }];
            if (negativePrompt) {
                // Note: Negative prompt support depends on model version, usually appended to prompt or specific param
                parts.push({ text: `Negative prompt: ${negativePrompt}` });
            }

            const result = await model.generateContent({
                contents: [{ role: 'user', parts }],
                generationConfig,
                safetySettings
            });

            const response = await result.response;
            return this._processResponse(response);
        } catch (error) {
            console.error('Gemini generateImage error:', error);
            throw error;
        }
    }

    /**
     * Edit an existing image based on a text prompt
     * @param {Buffer|string} imageInput - Buffer, base64 string, or file path
     * @param {string} prompt - Instructions for editing
     * @param {Object} options - Configuration options
     */
    async editImage(imageInput, prompt, options = {}) {
        if (!this.genAI) throw new Error('Gemini API key is not configured.');

        const {
            modelName = this.defaultModel,
            aspectRatio, // Optional, otherwise inferred
            imageSize = '2K',
            referenceImages = [], // Array of additional reference images
            safetySettings
        } = options;

        try {
            const model = this.genAI.getGenerativeModel({ model: modelName });

            // Prepare main image
            const mainImagePart = await this._inputToPart(imageInput);

            // Prepare reference images (up to 14 supported by Pro)
            const referenceParts = await Promise.all(
                referenceImages.map(img => this._inputToPart(img))
            );

            const parts = [
                { text: prompt },
                mainImagePart,
                ...referenceParts
            ];

            const generationConfig = {
                responseModalities: ['IMAGE', 'TEXT'], // Allow text explanation if needed
                imageConfig: {
                    imageSize
                }
            };

            if (aspectRatio) {
                generationConfig.imageConfig.aspectRatio = aspectRatio;
            }

            const result = await model.generateContent({
                contents: [{ role: 'user', parts }],
                generationConfig,
                safetySettings
            });

            const response = await result.response;
            return this._processResponse(response);
        } catch (error) {
            console.error('Gemini editImage error:', error);
            throw error;
        }
    }

    /**
     * Start a multi-turn conversation for iterative image editing
     * @param {Object} config - Chat configuration
     */
    async createEditingChat(config = {}) {
        if (!this.genAI) throw new Error('Gemini API key is not configured.');

        const {
            modelName = this.defaultModel,
            history = [],
            enableSearch = false
        } = config;

        const tools = [];
        if (enableSearch) {
            tools.push({ googleSearch: {} });
        }

        const chat = this.genAI.getGenerativeModel({
            model: modelName,
            tools
        }).startChat({
            history,
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE']
            }
        });

        return chat;
    }

    /**
     * Send a message to an existing chat session
     * @param {Object} chat - The chat session object
     * @param {string} message - The text message/instruction
     * @param {Buffer|string} imageInput - Optional image to include in this turn
     */
    async sendChatMessage(chat, message, imageInput = null, options = {}) {
        try {
            const parts = [{ text: message }];

            if (imageInput) {
                const imagePart = await this._inputToPart(imageInput);
                parts.push(imagePart);
            }

            const result = await chat.sendMessage(parts);
            const response = await result.response;
            return this._processResponse(response);
        } catch (error) {
            console.error('Gemini sendChatMessage error:', error);
            throw error;
        }
    }

    /**
   * Create a batch job for processing multiple images
   * @param {Array} requests - Array of request objects { prompt, imageInput, id }
   * @param {Object} options - Batch options
   */
    async createBatchJob(requests, options = {}) {
        if (!this.genAI) throw new Error('Gemini API key is not configured.');

        const {
            modelName = this.flashModel, // Batch is often used with Flash for efficiency
            displayName = `batch_job_${Date.now()}`
        } = options;

        try {
            // 1. Create JSONL content
            const jsonlLines = [];

            for (const [index, req] of requests.entries()) {
                const parts = [{ text: req.prompt }];

                if (req.imageInput) {
                    const imagePart = await this._inputToPart(req.imageInput);
                    parts.push(imagePart);
                }

                const batchRequest = {
                    custom_id: req.id || `req_${index}`,
                    request: {
                        contents: [{ role: 'user', parts }],
                        generationConfig: {
                            responseModalities: ['IMAGE'],
                            imageConfig: {
                                aspectRatio: options.aspectRatio || '1:1',
                                imageSize: options.imageSize || '1K'
                            }
                        }
                    }
                };

                jsonlLines.push(JSON.stringify(batchRequest));
            }

            const jsonlContent = jsonlLines.join('\n');
            const tempFilePath = path.join(process.cwd(), `temp_batch_${Date.now()}.jsonl`);
            await fs.promises.writeFile(tempFilePath, jsonlContent);

            // 2. Upload file to Gemini
            // Note: The @google/generative-ai SDK currently has limited file API support exposed directly
            // We might need to use the FileManager API if available or fallback to REST
            // Assuming FileManager is available via getGenerativeModel or similar, but typically it's separate.
            // For now, we'll assume the SDK exposes a way or we'd need to fetch directly.
            // Since the current SDK version might not have full Batch support, we'll implement
            // a robust REST fallback for the Batch operations.

            const uploadResult = await this._uploadFileRest(tempFilePath, 'application/json');

            // Clean up temp file
            await fs.promises.unlink(tempFilePath);

            // 3. Create Batch Job via REST
            const batchJob = await this._createBatchJobRest(uploadResult.uri, modelName, displayName);

            return batchJob;
        } catch (error) {
            console.error('Gemini createBatchJob error:', error);
            throw error;
        }
    }

    /**
     * Get the status of a batch job
     * @param {string} jobName - The resource name of the batch job
     */
    async getBatchJobStatus(jobName) {
        return this._getBatchJobRest(jobName);
    }

    /**
     * Get results from a completed batch job
     * @param {string} outputUri - The output URI from the completed job
     */
    async getBatchResults(outputUri) {
        // Download the results file
        const content = await this._downloadFileRest(outputUri);

        // Parse JSONL results
        const results = [];
        const lines = content.split('\n');

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const item = JSON.parse(line);
                // Process the item similar to _processResponse but for batch structure
                // Batch output structure varies, typically has custom_id and response

                if (item.response) {
                    const processed = await this._processResponse(item.response);
                    results.push({
                        id: item.custom_id,
                        status: 'success',
                        ...processed
                    });
                } else {
                    results.push({
                        id: item.custom_id,
                        status: 'failed',
                        error: item.error
                    });
                }
            } catch (e) {
                console.error('Error parsing batch result line:', e);
            }
        }

        return results;
    }

    // --- REST Helpers for Batch API (until SDK fully supports it) ---

    async _uploadFileRest(filePath, mimeType) {
        const stats = await fs.promises.stat(filePath);
        const numBytes = stats.size;
        const fileContent = await fs.promises.readFile(filePath);

        // 1. Start upload
        const startUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${this.genAI.apiKey}`;
        const startResp = await fetch(startUrl, {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': numBytes,
                'X-Goog-Upload-Header-Content-Type': mimeType,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ file: { display_name: path.basename(filePath) } })
        });

        const uploadUrl = startResp.headers.get('x-goog-upload-url');

        // 2. Upload content
        const uploadResp = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'upload, finalize',
                'X-Goog-Upload-Offset': '0',
                'Content-Length': numBytes,
                'Content-Type': mimeType
            },
            body: fileContent
        });

        const result = await uploadResp.json();
        return result.file;
    }

    async _createBatchJobRest(fileUri, model, displayName) {
        const url = `https://generativelanguage.googleapis.com/v1beta/batches?key=${this.genAI.apiKey}`;

        // Correction: The Batch API payload for File API source
        const payload = {
            model: `models/${model}`,
            input_file: {
                uri: fileUri
            },
            display_name: displayName
        };

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Batch creation failed: ${err}`);
        }

        return resp.json();
    }

    async _getBatchJobRest(jobName) {
        const url = `https://generativelanguage.googleapis.com/v1beta/${jobName}?key=${this.genAI.apiKey}`;
        const resp = await fetch(url);
        return resp.json();
    }

    async _downloadFileRest(uri) {
        // If it's a File API URI, we can download it
        // Format: https://generativelanguage.googleapis.com/v1beta/files/NAME
        // But we need to use the key

        // Extract file name from URI if needed, or just append key
        // URI example: https://generativelanguage.googleapis.com/v1beta/files/abc-123

        const url = `${uri}?key=${this.genAI.apiKey}&alt=media`; // alt=media to get content
        const resp = await fetch(url);
        return resp.text();
    }

    /**
     * Helper to process the model response
     */
    async _processResponse(response) {
        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('No candidates returned from Gemini');
        }

        const result = {
            text: response.text(), // Get text if present
            images: []
        };

        // Extract images from parts
        const parts = candidates[0].content.parts;
        for (const part of parts) {
            if (part.inlineData) {
                result.images.push({
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data // base64 string
                });
            }
        }

        return result;
    }

    /**
     * Helper to convert various input types to GenerativePart
     */
    async _inputToPart(input) {
        // If it's already a part object
        if (typeof input === 'object' && input.inlineData) {
            return input;
        }

        let mimeType = 'image/jpeg';
        let data = '';

        if (Buffer.isBuffer(input)) {
            data = input.toString('base64');
        } else if (typeof input === 'string') {
            if (input.startsWith('data:')) {
                // Data URL
                const matches = input.match(/^data:([^;]+);base64,(.+)$/);
                if (matches) {
                    mimeType = matches[1];
                    data = matches[2];
                } else {
                    throw new Error('Invalid data URL format');
                }
            } else if (fs.existsSync(input)) {
                // File path
                const ext = path.extname(input).toLowerCase();
                if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.webp') mimeType = 'image/webp';
                else if (ext === '.heic') mimeType = 'image/heic';
                else if (ext === '.heif') mimeType = 'image/heif';

                const buffer = await fs.promises.readFile(input);
                data = buffer.toString('base64');
            } else {
                // Assume raw base64 string, default mime type
                data = input;
            }
        } else {
            throw new Error('Unsupported image input type');
        }

        return {
            inlineData: {
                data,
                mimeType
            }
        };
    }

    /**
     * Helper to save a base64 image to disk
     */
    static async saveImage(base64Data, outputPath) {
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.promises.writeFile(outputPath, buffer);
        return outputPath;
    }
}
