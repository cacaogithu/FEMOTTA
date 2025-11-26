
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { getAllFeedback } from '../utils/jobStore.js';
import { GeminiService } from './geminiService.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const gemini = new GeminiService(process.env.GEMINI_API_KEY);
const preferredProvider = process.env.AI_PROVIDER || 'openai';

const promptVersions = new Map();
const basePromptImprovements = new Map();
const exampleRepository = new Map(); // Store successful examples

// Automated quality analysis for each result
export async function analyzeResultQuality(jobId, editedImageUrl, originalPrompt, briefText) {
  try {
    console.log(`[Active Learning] Analyzing result quality for job ${jobId}`);

    const systemPrompt = `You are an expert image quality analyzer. Analyze the edited marketing image for:
1. **Text Quality**: Spelling errors, grammar issues, typos
2. **Design Quality**: Gradient positioning, text readability, shadow effectiveness
3. **Brand Consistency**: Professional appearance, color harmony
4. **Technical Issues**: Truncation, overlapping elements, poor contrast

Provide:
- Quality score (1-10)
- List of specific issues found
- Suggestions for improvement
- Whether this is a good example to learn from (true/false)`;

    const userPrompt = `Analyze this edited marketing image.\n\nOriginal prompt: "${originalPrompt}"\n\nBrief context: "${briefText.substring(0, 500)}..."`;

    let analysis;

    if (preferredProvider === 'gemini' && gemini.genAI) {
      // For Gemini, we can pass image URL directly if supported or fetch and pass base64
      // Assuming Gemini Vision can handle URLs or we need to fetch it.
      // For simplicity in this iteration, we'll try to use the text-only analysis if image fetching is complex,
      // BUT Gemini Vision is key here.
      // Let's assume we can pass the image URL to a helper or fetch it.
      // Since `editedImageUrl` is likely a public URL or signed URL.

      // Fetching image to buffer for Gemini
      try {
        const imgResp = await fetch(editedImageUrl);
        const imgBuffer = await imgResp.arrayBuffer();
        const imagePart = GeminiService.fileToGenerativePart(Buffer.from(imgBuffer), imgResp.headers.get('content-type'));

        analysis = await gemini.analyzeImage(`${systemPrompt}\n\n${userPrompt}`, [imagePart]);
      } catch (e) {
        console.error('Failed to fetch image for Gemini analysis, falling back to text or skipping', e);
        // Fallback to OpenAI if Gemini image fetch fails? Or just fail.
        // Let's try OpenAI as fallback if configured
        if (process.env.OPENAI_API_KEY) {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt },
                  { type: 'image_url', image_url: { url: editedImageUrl, detail: 'high' } }
                ]
              }
            ],
            temperature: 0.3,
            max_tokens: 800
          });
          analysis = completion.choices[0].message.content;
        } else {
          throw e;
        }
      }

    } else {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: editedImageUrl, detail: 'high' } }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      });
      analysis = completion.choices[0].message.content;
    }

    console.log('[Active Learning] Analysis:', analysis);

    // Parse the analysis
    const qualityData = parseQualityAnalysis(analysis);

    // Store in example repository if high quality
    if (qualityData.isGoodExample && qualityData.score >= 8) {
      storeSuccessfulExample(jobId, {
        imageUrl: editedImageUrl,
        prompt: originalPrompt,
        briefText,
        score: qualityData.score,
        analysis,
        timestamp: new Date().toISOString()
      });
    }

    return qualityData;

  } catch (error) {
    console.error('[Active Learning] Quality analysis error:', error);
    return null;
  }
}

function parseQualityAnalysis(analysisText) {
  const scoreMatch = analysisText.match(/score[:\s]+(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;

  const isGoodExample = analysisText.toLowerCase().includes('good example: true') ||
    analysisText.toLowerCase().includes('is a good example') ||
    score >= 8;

  const issues = [];
  const lines = analysisText.split('\n');
  let inIssuesSection = false;

  for (const line of lines) {
    if (line.toLowerCase().includes('issues') || line.toLowerCase().includes('problems')) {
      inIssuesSection = true;
      continue;
    }
    if (inIssuesSection && line.trim().startsWith('-')) {
      issues.push(line.trim().substring(1).trim());
    }
  }

  return {
    score,
    isGoodExample,
    issues,
    fullAnalysis: analysisText
  };
}

function storeSuccessfulExample(jobId, exampleData) {
  const key = `example_${Date.now()}_${jobId}`;
  exampleRepository.set(key, exampleData);

  // Keep only last 50 examples to prevent memory bloat
  if (exampleRepository.size > 50) {
    const firstKey = exampleRepository.keys().next().value;
    exampleRepository.delete(firstKey);
  }

  console.log(`[Active Learning] Stored successful example. Total: ${exampleRepository.size}`);
}

export function getSuccessfulExamples(limit = 10) {
  const examples = Array.from(exampleRepository.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return examples;
}

// Enhanced prompt improvement using stored examples
export async function improvePromptWithFeedback(jobId, feedbackData, includeExamples = true) {
  try {
    console.log(`[ML Learning] Analyzing feedback for job ${jobId}`);

    const allFeedback = getAllFeedback();
    const recentFeedback = allFeedback.slice(-20);

    const lowRatingFeedback = recentFeedback.filter(f => f.rating < 60);
    const highRatingFeedback = recentFeedback.filter(f => f.rating >= 75);

    if (lowRatingFeedback.length === 0) {
      console.log('[ML Learning] No low ratings - current prompts performing well');
      return null;
    }

    // Get successful examples from repository
    const successfulExamples = includeExamples ? getSuccessfulExamples(5) : [];

    const feedbackSummary = `
RECENT FEEDBACK ANALYSIS:
Total feedback entries: ${recentFeedback.length}
Average rating: ${(recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length).toFixed(2)}/5

HIGH-RATED RESULTS (${highRatingFeedback.length} cases, ≥75/100):
${highRatingFeedback.map(f => `- Prompt: "${f.originalPrompt?.substring(0, 100)}..." (Rating: ${f.rating}/100)${f.comments ? `\n  Feedback: ${f.comments}` : ''}`).join('\n')}

LOW-RATED RESULTS (${lowRatingFeedback.length} cases, <60/100):
${lowRatingFeedback.map(f => `- Prompt: "${f.originalPrompt?.substring(0, 100)}..." (Rating: ${f.rating}/100)${f.comments ? `\n  User feedback: ${f.comments}` : ''}`).join('\n')}

${successfulExamples.length > 0 ? `
SUCCESSFUL EXAMPLES FROM ACTIVE LEARNING (${successfulExamples.length} high-quality results):
${successfulExamples.map((ex, i) => `
Example ${i + 1} (Score: ${ex.score}/10):
- Prompt: "${ex.prompt.substring(0, 150)}..."
- Analysis: ${ex.analysis.substring(0, 200)}...
- Timestamp: ${ex.timestamp}
`).join('\n')}
` : ''}

CURRENT FEEDBACK:
Prompt: "${feedbackData.originalPrompt}"
Rating: ${feedbackData.rating}/100
Comments: ${feedbackData.comments || 'None'}
`;

    console.log('[ML Learning] Sending feedback to AI for analysis...');

    const systemPrompt = `You are an AI prompt optimization expert with active learning capabilities. Analyze user feedback AND high-quality automated examples to improve prompts.

Your task:
1. **Learn from successful examples** - Identify what made high-scoring results successful
2. **Identify failure patterns** - What causes low ratings and quality issues
3. **Detect common mistakes** - Spelling errors, poor gradient placement, text truncation
4. **Synthesize improvements** - Create an optimized prompt that combines best practices

Focus on:
- **Text accuracy**: Preventing misspellings and grammar errors
- **Gradient quality**: Natural positioning, appropriate darkness/lightness
- **Text readability**: Shadow strength, font sizing, contrast
- **Layout intelligence**: Adaptive positioning based on image composition

CRITICAL RULES:
- DO NOT include specific text content (like "EXPERIENCE THE FUTURE")
- Text content comes from the brief - keep as {title}, {subtitle} placeholders
- Focus on technical guidelines: gradient positioning, shadow effects, font sizing
- Allow adaptive font sizes: "48-60px for title, adjust based on aspect ratio"
- Learn from successful examples to avoid repeating mistakes

OUTPUT FORMAT:
Provide analysis and then on a new line starting with "IMPROVED_PROMPT:" followed by the optimized prompt.`;

    let analysis;

    if (preferredProvider === 'gemini' && gemini.genAI) {
      analysis = await gemini.generateContent(`${systemPrompt}\n\n${feedbackSummary}`);
    } else {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: feedbackSummary }
        ],
        temperature: 0.7,
        max_tokens: 1200
      });
      analysis = completion.choices[0].message.content;
    }

    console.log('[ML Learning] Analysis received:', analysis);

    const suggestedPrompt = extractSuggestedPrompt(analysis, feedbackData.originalPrompt);

    const improvementRecord = {
      jobId,
      originalPrompt: feedbackData.originalPrompt,
      improvedPrompt: suggestedPrompt,
      analysis,
      usedExamples: successfulExamples.length,
      timestamp: new Date().toISOString(),
      triggerRating: feedbackData.rating,
      feedbackCount: allFeedback.length
    };

    const currentVersion = promptVersions.get('main') || [];
    currentVersion.push(improvementRecord);
    promptVersions.set('main', currentVersion);

    basePromptImprovements.set('latest', {
      prompt: suggestedPrompt,
      confidence: calculateConfidence(highRatingFeedback.length, lowRatingFeedback.length, successfulExamples.length),
      createdAt: new Date().toISOString(),
      basedOnFeedback: allFeedback.length,
      basedOnExamples: successfulExamples.length
    });

    console.log('[ML Learning] Prompt improvement recorded. Total improvements:', currentVersion.length);
    console.log('[ML Learning] Used', successfulExamples.length, 'successful examples for learning');

    return {
      analysis,
      suggestedImprovement: suggestedPrompt,
      examplesUsed: successfulExamples.length
    };

  } catch (error) {
    console.error('[ML Learning] Error:', error);
    throw error;
  }
}

function extractSuggestedPrompt(analysis, originalPrompt) {
  // Look for IMPROVED_PROMPT: marker
  const improvedMatch = analysis.match(/IMPROVED_PROMPT:\s*(.+?)(?:\n\n|$)/s);
  if (improvedMatch) {
    const suggested = improvedMatch[1].trim().replace(/^["']|["']$/g, '');

    // Reject if it contains specific hardcoded text
    if (suggested.toLowerCase().includes('experience the future') ||
      suggested.toLowerCase().includes('transform your workout')) {
      console.log('[ML Learning] Rejecting hallucinated prompt with specific text content');
      return originalPrompt;
    }

    return suggested;
  }

  // Fallback to old extraction method
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

function calculateConfidence(highCount, lowCount, exampleCount) {
  const total = highCount + lowCount;
  if (total === 0) return 0;
  if (lowCount === 0) return 0.5;

  const ratio = lowCount / total;
  const baseConfidence = Math.min(0.9, 0.5 + (ratio * 0.4));

  // Boost confidence if we have successful examples
  const exampleBoost = Math.min(0.1, exampleCount * 0.02);

  return Math.min(0.95, baseConfidence + exampleBoost);
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
    }, true); // Include examples

    return {
      suggestion: improvement?.suggestedImprovement || originalPrompt,
      confidence: 0.7,
      analysis: improvement?.analysis,
      examplesUsed: improvement?.examplesUsed || 0,
      message: 'Prompt optimized based on user feedback and successful examples'
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

  if (avgRating >= 75) {
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
    examplesUsed: bestPrompt.basedOnExamples || 0,
    reason: `Using AI-improved prompt (${allFeedback.length} feedback, ${bestPrompt.basedOnExamples || 0} examples, avg: ${avgRating.toFixed(2)})`
  };
}

export function getLearningStats() {
  return {
    totalExamples: exampleRepository.size,
    exampleScores: Array.from(exampleRepository.values()).map(ex => ex.score),
    avgExampleScore: exampleRepository.size > 0
      ? (Array.from(exampleRepository.values()).reduce((sum, ex) => sum + ex.score, 0) / exampleRepository.size).toFixed(2)
      : 0,
    totalImprovements: promptVersions.get('main')?.length || 0
  };
}
