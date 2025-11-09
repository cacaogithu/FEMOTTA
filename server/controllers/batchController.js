import GeminiBatchService from '../services/geminiBatchService.js';

export const submitBriefAnalysisBatch = async (req, res) => {
  try {
    const { briefs } = req.body;

    if (!briefs || !Array.isArray(briefs) || briefs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Briefs array is required'
      });
    }

    const batchService = new GeminiBatchService(process.env.GEMINI_API_KEY);

    const jobMetadata = await batchService.createBriefAnalysisBatch(briefs);
    const costEstimate = await batchService.estimateCostSavings(briefs.length, 800);

    res.json({
      success: true,
      job: jobMetadata,
      costEstimate,
      message: `Batch job submitted with ${briefs.length} briefs. Results in ~24 hours at 50% cost.`
    });

  } catch (error) {
    console.error('[Batch API] Brief analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const submitQualityCheckBatch = async (req, res) => {
  try {
    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Images array is required'
      });
    }

    const batchService = new GeminiBatchService(process.env.GEMINI_API_KEY);

    const jobMetadata = await batchService.createQualityCheckBatch(images);
    const costEstimate = await batchService.estimateCostSavings(images.length, 600);

    res.json({
      success: true,
      job: jobMetadata,
      costEstimate,
      message: `Batch job submitted with ${images.length} images. Quality analysis in ~24 hours at 50% cost.`
    });

  } catch (error) {
    console.error('[Batch API] Quality check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const submitPromptOptimizationBatch = async (req, res) => {
  try {
    const { feedbackData } = req.body;

    if (!feedbackData || !Array.isArray(feedbackData) || feedbackData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Feedback data array is required'
      });
    }

    const batchService = new GeminiBatchService(process.env.GEMINI_API_KEY);

    const jobMetadata = await batchService.createPromptOptimizationBatch(feedbackData);
    const costEstimate = await batchService.estimateCostSavings(feedbackData.length, 1000);

    res.json({
      success: true,
      job: jobMetadata,
      costEstimate,
      message: `Batch job submitted with ${feedbackData.length} feedback items. Optimized prompts in ~24 hours at 50% cost.`
    });

  } catch (error) {
    console.error('[Batch API] Prompt optimization error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getBatchJobStatus = async (req, res) => {
  try {
    const { batchJobName } = req.params;

    const batchService = new GeminiBatchService(process.env.GEMINI_API_KEY);

    const status = await batchService.checkBatchStatus(batchJobName);

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('[Batch API] Status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getBatchJobResults = async (req, res) => {
  try {
    const { batchJobName } = req.params;

    const batchService = new GeminiBatchService(process.env.GEMINI_API_KEY);

    const results = await batchService.getBatchResults(batchJobName);

    res.json({
      success: true,
      results,
      count: results.length
    });

  } catch (error) {
    console.error('[Batch API] Results retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export default {
  submitBriefAnalysisBatch,
  submitQualityCheckBatch,
  submitPromptOptimizationBatch,
  getBatchJobStatus,
  getBatchJobResults
};
