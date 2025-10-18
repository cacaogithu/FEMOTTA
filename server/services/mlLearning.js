import OpenAI from 'openai';
import { getAllFeedback } from '../utils/jobStore.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const promptVersions = new Map();
const basePromptImprovements = new Map();

export async function improvePromptWithFeedback(jobId, feedbackData) {
  try {
    console.log(`[ML Learning] Analyzing feedback for job ${jobId}`);

    const allFeedback = getAllFeedback();
    const recentFeedback = allFeedback.slice(-20);

    const lowRatingFeedback = recentFeedback.filter(f => f.rating <= 2);
    const highRatingFeedback = recentFeedback.filter(f => f.rating >= 4);

    if (lowRatingFeedback.length === 0) {
      console.log('[ML Learning] No low ratings - current prompts performing well');
      return null;
    }

    const feedbackSummary = `
RECENT FEEDBACK ANALYSIS:
Total feedback entries: ${recentFeedback.length}
Average rating: ${(recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length).toFixed(2)}/5

HIGH-RATED RESULTS (${highRatingFeedback.length} cases):
${highRatingFeedback.map(f => `- Prompt: "${f.originalPrompt?.substring(0, 100)}..." (Rating: ${f.rating}/5)${f.comments ? `\n  Feedback: ${f.comments}` : ''}`).join('\n')}

LOW-RATED RESULTS (${lowRatingFeedback.length} cases):
${lowRatingFeedback.map(f => `- Prompt: "${f.originalPrompt?.substring(0, 100)}..." (Rating: ${f.rating}/5)${f.comments ? `\n  User feedback: ${f.comments}` : ''}`).join('\n')}

CURRENT FEEDBACK:
Prompt: "${feedbackData.originalPrompt}"
Rating: ${feedbackData.rating}/5
Comments: ${feedbackData.comments || 'None'}
`;

    console.log('[ML Learning] Sending feedback to GPT-4 for analysis...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI prompt optimization expert. Analyze user feedback on image editing results and improve the prompts to achieve better outcomes.

Your task:
1. Identify patterns in what makes prompts successful vs unsuccessful
2. Suggest specific improvements to prompts that received low ratings
3. Provide an optimized version of the current prompt
4. Explain what changes you made and why

Focus on:
- Clarity and specificity of instructions for gradient application (positioning, fade points, opacity)
- Technical accuracy (gradient darkness, text shadow strength, font sizing flexibility)
- Artistic quality (natural-looking gradients, readable shadows)
- Maintaining brand consistency while adapting to different image compositions

CRITICAL RULES:
- DO NOT include specific text content in your improved prompt (like "EXPERIENCE THE FUTURE")
- Text content comes from the PDF brief and varies per image - keep it as placeholders like {title} and {subtitle}
- Focus on improving gradient positioning, shadow effects, and font sizing guidelines
- Allow font sizes to be adaptive based on image composition (e.g., "48-60px for title, adjust based on image aspect ratio")
- Ensure gradients adapt to image brightness - darker images need lighter gradients, lighter images need darker gradients`
        },
        {
          role: 'user',
          content: feedbackSummary
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const analysis = completion.choices[0].message.content;
    console.log('[ML Learning] Analysis received:', analysis);

    const suggestedPrompt = extractSuggestedPrompt(analysis, feedbackData.originalPrompt);

    const improvementRecord = {
      jobId,
      originalPrompt: feedbackData.originalPrompt,
      improvedPrompt: suggestedPrompt,
      analysis,
      timestamp: new Date().toISOString(),
      triggerRating: feedbackData.rating,
      feedbackCount: allFeedback.length
    };

    const currentVersion = promptVersions.get('main') || [];
    currentVersion.push(improvementRecord);
    promptVersions.set('main', currentVersion);

    basePromptImprovements.set('latest', {
      prompt: suggestedPrompt,
      confidence: calculateConfidence(highRatingFeedback.length, lowRatingFeedback.length),
      createdAt: new Date().toISOString(),
      basedOnFeedback: allFeedback.length
    });

    console.log('[ML Learning] Prompt improvement recorded. Total improvements:', currentVersion.length);
    console.log('[ML Learning] New improved prompt saved:', suggestedPrompt.substring(0, 100));

    return {
      analysis,
      suggestedImprovement: suggestedPrompt
    };

  } catch (error) {
    console.error('[ML Learning] Error:', error);
    throw error;
  }
}

function extractSuggestedPrompt(analysis, originalPrompt) {
  // Don't use GPT-4's suggested prompt if it contains specific text content
  // We need to keep text content variable from the brief
  const lines = analysis.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('improved prompt') || 
        line.includes('optimized prompt') ||
        line.includes('suggested prompt') ||
        line.includes('better prompt') ||
        line.includes('revised prompt')) {
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine.length > 50 && !nextLine.toLowerCase().startsWith('explanation')) {
          const suggested = nextLine.replace(/^["']|["']$/g, '');
          // Reject if it contains specific hardcoded text
          if (suggested.toLowerCase().includes('experience the future') || 
              suggested.toLowerCase().includes('transform your workout')) {
            console.log('[ML Learning] Rejecting hallucinated prompt with specific text content');
            return originalPrompt;
          }
          return suggested;
        }
      }
    }
  }
  
  return originalPrompt;
}

function calculateConfidence(highCount, lowCount) {
  const total = highCount + lowCount;
  if (total === 0) return 0;
  if (lowCount === 0) return 0.5;
  
  const ratio = lowCount / total;
  return Math.min(0.9, 0.5 + (ratio * 0.4));
}

export async function getPromptImprovement(originalPrompt, userFeedback) {
  try {
    const allFeedback = getAllFeedback();
    const similarPrompts = allFeedback.filter(f => 
      f.originalPrompt && f.originalPrompt.toLowerCase().includes(originalPrompt.toLowerCase().substring(0, 50))
    );

    if (similarPrompts.length === 0) {
      return {
        suggestion: originalPrompt,
        confidence: 0,
        message: 'No similar prompts found for comparison'
      };
    }

    const avgRating = similarPrompts.reduce((sum, f) => sum + f.rating, 0) / similarPrompts.length;

    if (avgRating >= 4) {
      return {
        suggestion: originalPrompt,
        confidence: 0.9,
        message: 'This prompt style has been working well'
      };
    }

    const improvement = await improvePromptWithFeedback('analysis', {
      originalPrompt,
      rating: avgRating,
      comments: userFeedback
    });

    return {
      suggestion: improvement?.suggestedImprovement || originalPrompt,
      confidence: 0.7,
      analysis: improvement?.analysis,
      message: 'Prompt optimized based on user feedback patterns'
    };

  } catch (error) {
    console.error('Get prompt improvement error:', error);
    return {
      suggestion: originalPrompt,
      confidence: 0,
      message: 'Error analyzing prompt'
    };
  }
}

export function getPromptHistory() {
  return Array.from(promptVersions.entries()).map(([key, versions]) => ({
    promptKey: key,
    totalVersions: versions.length,
    versions: versions.slice(-5)
  }));
}

export function getBestPrompt() {
  const latest = basePromptImprovements.get('latest');
  
  if (!latest || latest.confidence < 0.3) {
    return null;
  }
  
  console.log('[ML Learning] Retrieving best prompt (confidence:', latest.confidence, ')');
  return latest;
}

export function shouldUseImprovedPrompt(originalPrompt) {
  const allFeedback = getAllFeedback();
  
  if (allFeedback.length < 3) {
    return { use: false, reason: 'Not enough feedback data yet' };
  }
  
  const avgRating = allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length;
  
  if (avgRating >= 4.0) {
    return { use: false, reason: 'Current prompts performing well', avgRating };
  }
  
  const bestPrompt = getBestPrompt();
  if (!bestPrompt) {
    return { use: false, reason: 'No improved prompt available yet' };
  }
  
  return { 
    use: true, 
    prompt: bestPrompt.prompt,
    confidence: bestPrompt.confidence,
    avgRating,
    reason: `Using AI-improved prompt (${allFeedback.length} feedback entries, avg rating: ${avgRating.toFixed(2)})`
  };
}
