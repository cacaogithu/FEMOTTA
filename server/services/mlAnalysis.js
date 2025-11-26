import OpenAI from 'openai';
import { db } from '../db.js';
import { feedback, editedImages, promptVersions, subaccountPrompts, jobs } from '../../shared/schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import { GeminiService } from './geminiService.js';

export class MLAnalysisService {
  constructor(openaiApiKey, geminiApiKey) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.gemini = new GeminiService(geminiApiKey);
    this.preferredProvider = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'gemini'
  }

  async analyzePromptPerformance(subaccountId, options = {}) {
    const { daysBack = 30, minFeedbackCount = 5 } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const allPrompts = await db
      .select()
      .from(subaccountPrompts)
      .where(eq(subaccountPrompts.brandId, subaccountId));

    const promptAnalysis = [];

    for (const prompt of allPrompts) {
      const versions = await db
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.promptId, prompt.id))
        .orderBy(desc(promptVersions.versionNumber));

      for (const version of versions) {
        const versionFeedback = await this.getVersionFeedback(version.id, cutoffDate);

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
        }
      }
    }

    return promptAnalysis;
  }

  async getVersionFeedback(versionId, cutoffDate) {
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
  }

  analyzeVersionPerformance(feedbackData) {
    const totalFeedback = feedbackData.length;

    const avgRating = feedbackData.reduce((sum, fb) => sum + fb.rating, 0) / totalFeedback;
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

    return {
      averageRating: avgRating,
      averageGoalAlignment: avgGoalAlignment,
      averageCreativity: avgCreativity,
      averageTechnical: avgTechnical,
      ratingDistribution,
      lowRatedFeedback,
      highRatedFeedback,
      successRate: (ratingDistribution[4] + ratingDistribution[5]) / totalFeedback
    };
  }

  async generatePromptSuggestions(promptAnalysis) {
    const suggestions = [];

    for (const analysis of promptAnalysis) {
      if (analysis.averageRating < 3.5 || analysis.lowRatedFeedback.length > 0) {
        const suggestion = await this.askAIForImprovement(analysis);
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
      }
    }

    return suggestions;
  }

  async askAIForImprovement(analysis) {
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
      let responseText;
      if (this.preferredProvider === 'gemini' && this.gemini.genAI) {
        responseText = await this.gemini.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      } else {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1500
        });
        responseText = response.choices[0].message.content;
      }

      return {
        analysis: this.extractSection(responseText, 'Problem Analysis'),
        improvedPrompt: this.extractSection(responseText, 'Improved Prompt'),
        keyChanges: this.extractSection(responseText, 'Key Changes'),
        expectedImpact: this.extractSection(responseText, 'Expected Impact'),
        rawResponse: responseText,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      return {
        error: error.message,
        analysis: 'Failed to generate AI analysis',
        improvedPrompt: analysis.promptTemplate,
        keyChanges: 'Error occurred',
        expectedImpact: 'Unable to predict'
      };
    }
  }

  extractSection(text, sectionName) {
    const regex = new RegExp(`\\*\\*${sectionName}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }

  async generateInsightsSummary(subaccountId, options = {}) {
    const promptAnalysis = await this.analyzePromptPerformance(subaccountId, options);

    if (promptAnalysis.length === 0) {
      return {
        summary: 'Not enough feedback data to generate insights. Need at least 5 feedback entries per prompt.',
        promptAnalysis: [],
        suggestions: [],
        overallMetrics: null
      };
    }

    const overallMetrics = {
      totalPromptsAnalyzed: promptAnalysis.length,
      averageRating: promptAnalysis.reduce((sum, p) => sum + p.averageRating, 0) / promptAnalysis.length,
      totalFeedback: promptAnalysis.reduce((sum, p) => sum + p.feedbackCount, 0),
      bestPerformingPrompt: promptAnalysis.reduce((best, p) =>
        p.averageRating > (best?.averageRating || 0) ? p : best, null
      ),
      worstPerformingPrompt: promptAnalysis.reduce((worst, p) =>
        p.averageRating < (worst?.averageRating || 5) ? p : worst, null
      )
    };

    const suggestions = await this.generatePromptSuggestions(promptAnalysis);

    return {
      summary: `Analyzed ${promptAnalysis.length} prompts with ${overallMetrics.totalFeedback} total feedback entries. Overall average rating: ${overallMetrics.averageRating.toFixed(2)}/5`,
      promptAnalysis,
      suggestions,
      overallMetrics,
      generatedAt: new Date()
    };
  }
}

export default MLAnalysisService;
