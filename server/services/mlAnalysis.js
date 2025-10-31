import OpenAI from 'openai';
import { db } from '../db.js';
import { feedback, editedImages, promptVersions, subaccountPrompts, jobs } from '../../shared/schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import logger, { logError, logApiCall } from '../utils/logger.js';

export class MLAnalysisService {
  constructor(openaiApiKey) {
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required for ML Analysis Service');
    }
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /**
   * Analyzes prompt performance based on feedback data
   * @param {number} subaccountId - Subaccount ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Array>} Prompt analysis results
   */
  async analyzePromptPerformance(subaccountId, options = {}) {
    const { daysBack = 30, minFeedbackCount = 5 } = options;
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      logger.info({
        subaccountId,
        daysBack,
        minFeedbackCount,
        cutoffDate
      }, 'Starting prompt performance analysis');

      const allPrompts = await db
        .select()
        .from(subaccountPrompts)
        .where(eq(subaccountPrompts.brandId, subaccountId));

      if (allPrompts.length === 0) {
        logger.warn({ subaccountId }, 'No prompts found for subaccount');
        return [];
      }

      const promptAnalysis = [];
      let totalFeedbackCount = 0;

      for (const prompt of allPrompts) {
        const versions = await db
          .select()
          .from(promptVersions)
          .where(eq(promptVersions.promptId, prompt.id))
          .orderBy(desc(promptVersions.versionNumber));

        for (const version of versions) {
          const versionFeedback = await this.getVersionFeedback(version.id, cutoffDate);
          totalFeedbackCount += versionFeedback.length;
          
          if (versionFeedback.length >= minFeedbackCount) {
            const analysis = this.analyzeVersionPerformance(versionFeedback);
            
            promptAnalysis.push({
              promptId: prompt.id,
              promptName: prompt.name,
              versionId: version.id,
              versionNumber: version.versionNumber,
              promptTemplate: version.promptTemplate,
              feedbackCount: versionFeedback.length,
              ...analysis,
              feedbackSamples: versionFeedback.slice(0, 10)
            });

            logger.debug({
              promptId: prompt.id,
              versionId: version.id,
              feedbackCount: versionFeedback.length,
              averageRating: analysis.averageRating
            }, 'Prompt version analyzed');
          } else {
            logger.debug({
              promptId: prompt.id,
              versionId: version.id,
              feedbackCount: versionFeedback.length,
              required: minFeedbackCount
            }, 'Skipping prompt version - insufficient feedback');
          }
        }
      }

      logger.info({
        subaccountId,
        totalPrompts: allPrompts.length,
        analyzedPrompts: promptAnalysis.length,
        totalFeedbackCount
      }, 'Prompt performance analysis completed');

      return promptAnalysis;
    } catch (error) {
      logError(error, {
        subaccountId,
        operation: 'analyzePromptPerformance'
      });
      throw new Error(`Failed to analyze prompt performance: ${error.message}`);
    }
  }

  /**
   * Gets feedback for a specific prompt version
   * @param {number} versionId - Prompt version ID
   * @param {Date} cutoffDate - Minimum date for feedback
   * @returns {Promise<Array>} Feedback data
   */
  async getVersionFeedback(versionId, cutoffDate) {
    try {
      const feedbackData = await db
        .select({
          rating: feedback.rating,
          feedbackText: feedback.feedbackText,
          goalAlignment: feedback.goalAlignment,
          creativityScore: feedback.creativityScore,
          technicalQuality: feedback.technicalQuality,
          improvementSuggestions: feedback.improvementSuggestions,
          createdAt: feedback.createdAt,
          promptUsed: editedImages.promptUsed
        })
        .from(feedback)
        .leftJoin(editedImages, eq(feedback.editedImageId, editedImages.id))
        .where(
          and(
            eq(editedImages.promptVersionId, versionId),
            gte(feedback.createdAt, cutoffDate)
          )
        )
        .orderBy(desc(feedback.createdAt));

      return feedbackData;
    } catch (error) {
      logError(error, {
        versionId,
        operation: 'getVersionFeedback'
      });
      return [];
    }
  }

  /**
   * Analyzes feedback data to calculate performance metrics
   * @param {Array} feedbackData - Array of feedback objects
   * @returns {Object} Performance metrics
   */
  analyzeVersionPerformance(feedbackData) {
    if (!feedbackData || feedbackData.length === 0) {
      return {
        averageRating: 0,
        averageGoalAlignment: 0,
        averageCreativity: 0,
        averageTechnical: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        lowRatedFeedback: [],
        highRatedFeedback: [],
        successRate: 0
      };
    }

    const totalFeedback = feedbackData.length;
    
    const avgRating = feedbackData.reduce((sum, fb) => sum + (fb.rating || 0), 0) / totalFeedback;
    const avgGoalAlignment = feedbackData.reduce((sum, fb) => sum + (fb.goalAlignment || 0), 0) / totalFeedback;
    const avgCreativity = feedbackData.reduce((sum, fb) => sum + (fb.creativityScore || 0), 0) / totalFeedback;
    const avgTechnical = feedbackData.reduce((sum, fb) => sum + (fb.technicalQuality || 0), 0) / totalFeedback;

    const ratingDistribution = {
      5: feedbackData.filter(fb => fb.rating === 5).length,
      4: feedbackData.filter(fb => fb.rating === 4).length,
      3: feedbackData.filter(fb => fb.rating === 3).length,
      2: feedbackData.filter(fb => fb.rating === 2).length,
      1: feedbackData.filter(fb => fb.rating === 1).length
    };

    const lowRatedFeedback = feedbackData
      .filter(fb => fb.rating <= 2)
      .map(fb => ({
        rating: fb.rating,
        text: fb.feedbackText,
        suggestions: fb.improvementSuggestions
      }));

    const highRatedFeedback = feedbackData
      .filter(fb => fb.rating >= 4)
      .map(fb => ({
        rating: fb.rating,
        text: fb.feedbackText
      }));

    const successRate = (ratingDistribution[4] + ratingDistribution[5]) / totalFeedback;

    return {
      averageRating: parseFloat(avgRating.toFixed(2)),
      averageGoalAlignment: parseFloat(avgGoalAlignment.toFixed(2)),
      averageCreativity: parseFloat(avgCreativity.toFixed(2)),
      averageTechnical: parseFloat(avgTechnical.toFixed(2)),
      ratingDistribution,
      lowRatedFeedback,
      highRatedFeedback,
      successRate: parseFloat(successRate.toFixed(2))
    };
  }

  /**
   * Generates prompt improvement suggestions using GPT-4
   * @param {Array} promptAnalysis - Prompt analysis data
   * @returns {Promise<Array>} Improvement suggestions
   */
  async generatePromptSuggestions(promptAnalysis) {
    if (!promptAnalysis || promptAnalysis.length === 0) {
      logger.warn('No prompt analysis data provided for suggestions');
      return [];
    }

    const suggestions = [];

    for (const analysis of promptAnalysis) {
      // Only generate suggestions for underperforming prompts
      if (analysis.averageRating < 3.5 || analysis.lowRatedFeedback.length > 0) {
        try {
          const suggestion = await this.askGPTForImprovement(analysis);
          suggestions.push({
            promptId: analysis.promptId,
            promptName: analysis.promptName,
            versionId: analysis.versionId,
            currentPerformance: {
              averageRating: analysis.averageRating,
              successRate: analysis.successRate,
              feedbackCount: analysis.feedbackCount
            },
            ...suggestion
          });
        } catch (error) {
          logger.error({
            promptId: analysis.promptId,
            versionId: analysis.versionId,
            error: error.message
          }, 'Failed to generate suggestion for prompt');
          
          suggestions.push({
            promptId: analysis.promptId,
            promptName: analysis.promptName,
            versionId: analysis.versionId,
            error: error.message,
            analysis: 'Failed to generate AI analysis',
            improvedPrompt: analysis.promptTemplate,
            keyChanges: 'Error occurred',
            expectedImpact: 'Unable to predict'
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Uses GPT-4 to analyze feedback and suggest prompt improvements
   * @param {Object} analysis - Prompt analysis data
   * @returns {Promise<Object>} GPT-4 suggestions
   */
  async askGPTForImprovement(analysis) {
    const startTime = Date.now();
    
    const systemPrompt = `You are an AI expert in prompt engineering for image editing. Your task is to analyze feedback on AI-generated marketing images and suggest improvements to the prompt template.

Focus on:
1. Identifying patterns in low-rated outputs
2. Understanding what users want based on their feedback
3. Suggesting specific, actionable improvements to the prompt
4. Maintaining the core intent while improving clarity and specificity`;

    const userPrompt = `Analyze this prompt performance and suggest improvements:

**Current Prompt:**
"${analysis.promptTemplate}"

**Performance Metrics:**
- Average Rating: ${analysis.averageRating}/5
- Success Rate: ${(analysis.successRate * 100).toFixed(1)}%
- Goal Alignment: ${analysis.averageGoalAlignment}/5
- Creativity: ${analysis.averageCreativity}/5
- Technical Quality: ${analysis.averageTechnical}/5

**Low-Rated Feedback (${analysis.lowRatedFeedback.length} instances):**
${analysis.lowRatedFeedback.slice(0, 5).map((fb, i) => 
  `${i + 1}. Rating: ${fb.rating}/5
     Feedback: ${fb.text || 'No text'}
     Suggestions: ${fb.suggestions || 'None'}`
).join('\n\n')}

**High-Rated Feedback (${analysis.highRatedFeedback.length} instances):**
${analysis.highRatedFeedback.slice(0, 3).map((fb, i) => 
  `${i + 1}. Rating: ${fb.rating}/5 - ${fb.text || 'No text'}`
).join('\n')}

Please provide:
1. **Problem Analysis**: What's causing the low ratings?
2. **Improved Prompt**: A revised version of the prompt
3. **Key Changes**: Specific modifications you made and why
4. **Expected Impact**: How this should improve the ratings`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const duration = Date.now() - startTime;
      logApiCall('OpenAI GPT-4', 'prompt improvement', duration, true);

      const gptResponse = response.choices[0].message.content;
      
      return {
        analysis: this.extractSection(gptResponse, 'Problem Analysis'),
        improvedPrompt: this.extractSection(gptResponse, 'Improved Prompt'),
        keyChanges: this.extractSection(gptResponse, 'Key Changes'),
        expectedImpact: this.extractSection(gptResponse, 'Expected Impact'),
        rawResponse: gptResponse,
        generatedAt: new Date()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logApiCall('OpenAI GPT-4', 'prompt improvement', duration, false);
      
      logError(error, {
        promptId: analysis.promptId,
        operation: 'askGPTForImprovement'
      });
      
      // Provide helpful error messages
      let errorMessage = error.message;
      if (error.message.includes('insufficient_quota')) {
        errorMessage = 'OpenAI API quota exceeded. Please check your billing settings.';
      } else if (error.message.includes('invalid_api_key')) {
        errorMessage = 'Invalid OpenAI API key. Please update your configuration.';
      } else if (error.message.includes('rate_limit')) {
        errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Extracts a specific section from GPT-4 response
   * @param {string} text - GPT-4 response text
   * @param {string} sectionName - Section name to extract
   * @returns {string} Extracted section
   */
  extractSection(text, sectionName) {
    const regex = new RegExp(`\\*\\*${sectionName}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Generates comprehensive insights summary for a subaccount
   * @param {number} subaccountId - Subaccount ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Insights summary
   */
  async generateInsightsSummary(subaccountId, options = {}) {
    try {
      const promptAnalysis = await this.analyzePromptPerformance(subaccountId, options);
      
      if (promptAnalysis.length === 0) {
        logger.warn({ subaccountId }, 'No prompt analysis data available');
        
        return {
          success: false,
          summary: `Not enough feedback data to generate insights. Need at least ${options.minFeedbackCount || 5} feedback entries per prompt.`,
          recommendation: 'Collect more feedback by having users rate the AI-generated images. Once you have sufficient data, the ML system will automatically analyze performance and suggest improvements.',
          promptAnalysis: [],
          suggestions: [],
          overallMetrics: null
        };
      }

      const overallMetrics = {
        totalPromptsAnalyzed: promptAnalysis.length,
        averageRating: parseFloat((promptAnalysis.reduce((sum, p) => sum + p.averageRating, 0) / promptAnalysis.length).toFixed(2)),
        totalFeedback: promptAnalysis.reduce((sum, p) => sum + p.feedbackCount, 0),
        bestPerformingPrompt: promptAnalysis.reduce((best, p) => 
          p.averageRating > (best?.averageRating || 0) ? p : best, null
        ),
        worstPerformingPrompt: promptAnalysis.reduce((worst, p) => 
          p.averageRating < (worst?.averageRating || 5) ? p : worst, null
        )
      };

      const suggestions = await this.generatePromptSuggestions(promptAnalysis);

      logger.info({
        subaccountId,
        totalPromptsAnalyzed: overallMetrics.totalPromptsAnalyzed,
        averageRating: overallMetrics.averageRating,
        suggestionsGenerated: suggestions.length
      }, 'Insights summary generated');

      return {
        success: true,
        summary: `Analyzed ${promptAnalysis.length} prompts with ${overallMetrics.totalFeedback} total feedback entries. Overall average rating: ${overallMetrics.averageRating}/5`,
        promptAnalysis,
        suggestions,
        overallMetrics,
        generatedAt: new Date()
      };
    } catch (error) {
      logError(error, {
        subaccountId,
        operation: 'generateInsightsSummary'
      });
      
      throw new Error(`Failed to generate insights summary: ${error.message}`);
    }
  }
}

export default MLAnalysisService;
