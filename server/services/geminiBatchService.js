const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const os = require('os');

class GeminiBatchService {
  constructor(apiKey) {
    this.client = new GoogleGenAI({ apiKey });
    this.batchJobsDir = path.join(os.tmpdir(), 'gemini-batch-jobs');
    
    if (!fs.existsSync(this.batchJobsDir)) {
      fs.mkdirSync(this.batchJobsDir, { recursive: true });
    }
  }

  async createBriefAnalysisBatch(briefs) {
    const requests = briefs.map((brief, idx) => ({
      key: `brief-${brief.id || idx}`,
      request: {
        contents: [{
          parts: [{
            text: `Analyze this marketing brief and extract key information:

${brief.content}

Provide a structured analysis including:
1. Target audience
2. Key messaging points
3. Visual style requirements
4. Product features to highlight
5. Call-to-action requirements

Format as JSON.`
          }]
        }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      }
    }));

    return await this.submitBatchJob(requests, 'gemini-2.5-flash', 'brief-analysis');
  }

  async createQualityCheckBatch(imageUrls) {
    const requests = imageUrls.map((img, idx) => ({
      key: `image-${img.id || idx}`,
      request: {
        contents: [{
          parts: [
            {
              text: `Analyze this marketing image for quality issues:
1. Text readability (truncated text, poor contrast, typos)
2. Visual composition (alignment, spacing, balance)
3. Brand consistency (colors, fonts, style)
4. Technical issues (artifacts, low resolution)

Rate overall quality 1-5 stars and provide specific feedback as JSON.`
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: img.base64Data
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              qualityRating: { type: 'number' },
              issues: {
                type: 'array',
                items: { type: 'string' }
              },
              recommendations: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        }
      }
    }));

    return await this.submitBatchJob(requests, 'gemini-2.5-pro', 'quality-check');
  }

  async createPromptOptimizationBatch(feedbackData) {
    const requests = feedbackData.map((feedback, idx) => ({
      key: `feedback-${feedback.id || idx}`,
      request: {
        contents: [{
          parts: [{
            text: `Analyze this user feedback on AI-edited marketing images:

Original Prompt: ${feedback.originalPrompt}
User Rating: ${feedback.rating}/5 stars
Feedback: ${feedback.comments}
Image Context: ${feedback.imageContext}

Suggest an improved prompt that addresses the user's concerns while maintaining the original intent. Explain what changes would improve results.

Format as JSON with fields: improvedPrompt, explanation, keyChanges`
          }]
        }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      }
    }));

    return await this.submitBatchJob(requests, 'gemini-2.5-pro', 'prompt-optimization');
  }

  async submitBatchJob(requests, model, jobType) {
    const timestamp = Date.now();
    const jobId = `${jobType}-${timestamp}`;
    const jsonlPath = path.join(this.batchJobsDir, `${jobId}.jsonl`);

    const jsonlContent = requests.map(req => JSON.stringify(req)).join('\n');
    fs.writeFileSync(jsonlPath, jsonlContent);

    console.log(`[Gemini Batch] Created JSONL file: ${jsonlPath} (${requests.length} requests)`);

    const uploadedFile = await this.client.files.upload({
      file: jsonlPath,
      config: {
        displayName: jobId,
        mimeType: 'application/jsonl'
      }
    });

    console.log(`[Gemini Batch] Uploaded file: ${uploadedFile.name}`);

    const batchJob = await this.client.batches.create({
      model,
      src: uploadedFile.name
    });

    console.log(`[Gemini Batch] Job created: ${batchJob.name} (Status: ${batchJob.state})`);

    const jobMetadata = {
      jobId,
      batchJobName: batchJob.name,
      model,
      jobType,
      status: batchJob.state,
      requestCount: requests.length,
      createdAt: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      costSavings: '50%'
    };

    const metadataPath = path.join(this.batchJobsDir, `${jobId}-metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(jobMetadata, null, 2));

    return jobMetadata;
  }

  async checkBatchStatus(batchJobName) {
    const job = await this.client.batches.get(batchJobName);
    
    return {
      status: job.state,
      name: job.name,
      model: job.model,
      createTime: job.createTime,
      startTime: job.startTime,
      endTime: job.endTime,
      outputUri: job.outputUri
    };
  }

  async getBatchResults(batchJobName) {
    const job = await this.client.batches.get(batchJobName);
    
    if (job.state !== 'SUCCEEDED') {
      throw new Error(`Batch job not ready. Current status: ${job.state}`);
    }

    const outputFile = await this.client.files.get(job.outputUri);
    const outputContent = await this.client.files.download(outputFile.name);
    
    const results = outputContent
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    return results.map(result => ({
      key: result.key,
      response: result.response?.candidates?.[0]?.content?.parts?.[0]?.text || null,
      error: result.error || null
    }));
  }

  async pollBatchUntilComplete(batchJobName, maxWaitHours = 24, pollIntervalMinutes = 5) {
    const maxPolls = (maxWaitHours * 60) / pollIntervalMinutes;
    let polls = 0;

    while (polls < maxPolls) {
      const status = await this.checkBatchStatus(batchJobName);
      
      console.log(`[Gemini Batch] Poll ${polls + 1}/${maxPolls}: ${status.status}`);

      if (status.status === 'SUCCEEDED') {
        return await this.getBatchResults(batchJobName);
      }

      if (status.status === 'FAILED') {
        throw new Error('Batch job failed');
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMinutes * 60 * 1000));
      polls++;
    }

    throw new Error('Batch job timeout - exceeded maximum wait time');
  }

  async estimateCostSavings(requestCount, avgTokensPerRequest = 500) {
    const standardCostPer1kTokens = 0.075;
    const batchCostPer1kTokens = 0.0375;
    
    const totalTokens = requestCount * avgTokensPerRequest;
    const standardCost = (totalTokens / 1000) * standardCostPer1kTokens;
    const batchCost = (totalTokens / 1000) * batchCostPer1kTokens;
    const savings = standardCost - batchCost;

    return {
      requestCount,
      estimatedTokens: totalTokens,
      standardCost: `$${standardCost.toFixed(2)}`,
      batchCost: `$${batchCost.toFixed(2)}`,
      savings: `$${savings.toFixed(2)}`,
      savingsPercent: '50%'
    };
  }
}

module.exports = GeminiBatchService;
