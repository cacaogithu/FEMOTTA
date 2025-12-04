/**
 * AI-Powered Logo Placement Analyzer
 * 
 * Uses GPT-4o to intelligently analyze brief text and determine:
 * 1. Which logos are actually requested (canonical keys)
 * 2. Optimal placement positions for each logo
 * 3. Appropriate sizing relative to the image
 * 
 * This service is designed to be called between mammoth extraction
 * and prompt generation to improve logo matching accuracy.
 */

import OpenAI from 'openai';

const CANONICAL_LOGO_REGISTRY = {
  'intel-core': {
    canonicalKey: 'intel-core',
    displayName: 'Intel Core',
    aliases: ['intel', 'intel core', 'intel core processor', 'core processor'],
    localPath: 'assets/logos/intel-core.png'
  },
  'intel-core-ultra': {
    canonicalKey: 'intel-core-ultra',
    displayName: 'Intel Core Ultra',
    aliases: ['intel core ultra', 'core ultra', 'ultra processor', 'intel ultra'],
    localPath: 'assets/logos/intel-core-ultra.png'
  },
  'amd-ryzen': {
    canonicalKey: 'amd-ryzen',
    displayName: 'AMD Ryzen',
    aliases: ['amd', 'ryzen', 'amd ryzen', 'ryzen 9000', 'ryzen 9', 'ryzen processor'],
    localPath: 'assets/logos/amd-ryzen.png'
  },
  'nvidia': {
    canonicalKey: 'nvidia',
    displayName: 'NVIDIA',
    aliases: ['nvidia', 'geforce', 'rtx', 'nvidia geforce', 'nvidia graphics'],
    localPath: 'assets/logos/nvidia.png'
  },
  'nvidia-50-series': {
    canonicalKey: 'nvidia-50-series',
    displayName: 'NVIDIA 50 Series',
    aliases: ['nvidia 50', '50 series', '5090', '5080', 'nvidia 5090', 'nvidia 5080', 'rtx 50', 'rtx 5090', 'rtx 5080'],
    localPath: 'assets/logos/nvidia-50-series.png'
  },
  'hydro-x': {
    canonicalKey: 'hydro-x',
    displayName: 'Hydro X',
    aliases: ['hydro x', 'hydro-x', 'hydro series', 'custom cooling', 'liquid cooling'],
    localPath: 'assets/logos/hydro-x.png'
  },
  'icue-link': {
    canonicalKey: 'icue-link',
    displayName: 'iCUE Link',
    aliases: ['icue', 'icue link', 'icue-link', 'i-cue', 'icue ecosystem'],
    localPath: 'assets/logos/icue-link.png'
  },
  'hydro-x-icue-link': {
    canonicalKey: 'hydro-x-icue-link',
    displayName: 'Hydro X & iCUE Link',
    aliases: ['hydro x & icue', 'hydro x and icue', 'hydro-x icue-link'],
    localPath: 'assets/logos/hydro-x-icue-link.png'
  },
  'corsair': {
    canonicalKey: 'corsair',
    displayName: 'Corsair',
    aliases: ['corsair', 'corsair gaming', 'corsair logo'],
    localPath: 'assets/logos/corsair.png'
  },
  'origin-pc': {
    canonicalKey: 'origin-pc',
    displayName: 'Origin PC',
    aliases: ['origin', 'origin pc', 'originpc'],
    localPath: 'assets/logos/origin-pc.png'
  }
};

const PLACEMENT_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

const SYSTEM_PROMPT = `You are an expert marketing image analyst. Your task is to analyze marketing brief text and determine logo requirements for each image specification.

AVAILABLE LOGOS (use these EXACT canonical keys):
${Object.entries(CANONICAL_LOGO_REGISTRY).map(([key, info]) => 
  `- "${key}": ${info.displayName} (aliases: ${info.aliases.join(', ')})`
).join('\n')}

ANALYSIS RULES:
1. Look for explicit logo requests like "Include Intel Core logo", "Add NVIDIA logo", etc.
2. Look for implicit logo requirements in subtitle text like "Powered by Intel Core (Logo)"
3. Check NOTES, LOGOS, or ASSETS columns for logo mentions
4. Match to the CLOSEST canonical key from the available list above
5. If "Intel Core Ultra" is mentioned, use "intel-core-ultra" NOT "intel-core"
6. If "NVIDIA 50 Series" or "RTX 5090/5080" is mentioned, use "nvidia-50-series" NOT "nvidia"
7. If both "Hydro X" and "iCUE Link" are mentioned together, use "hydro-x-icue-link"

PLACEMENT RULES:
- Primary logo: bottom-left (most common, best visibility)
- Secondary logo: bottom-right
- Tertiary logos: top-left, then top-right
- Consider product positioning - avoid placing logos where product appears
- For wide/banner images, prefer bottom placement
- For square images, any corner works

SIZING RULES:
- Standard logos: 8-10% of image width
- Wide banner logos (aspect ratio > 2:1): 6-8% of image width
- Multiple logos on same image: reduce each by 10-15%
- Partner logos (Intel, AMD, NVIDIA): standard size
- Brand logos (Corsair): can be slightly larger (10-12%)

Return a JSON object with analysis for EACH image specification.`;

/**
 * Analyze brief text and image specs to determine logo placement plans
 * @param {string} briefText - The extracted text from the DOCX
 * @param {Array} imageSpecs - Array of image specifications from initial extraction
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Array of logo placement plans for each spec
 */
export async function analyzeLogoPlacement(briefText, imageSpecs, options = {}) {
  const openai = new OpenAI({
    apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY
  });

  console.log('[LogoAnalyzer] Starting AI-powered logo placement analysis...');
  console.log(`[LogoAnalyzer] Analyzing ${imageSpecs.length} image specifications`);

  const userPrompt = `Analyze the following marketing brief and image specifications to determine logo requirements.

BRIEF TEXT:
${briefText.substring(0, 8000)}

IMAGE SPECIFICATIONS (from initial extraction):
${JSON.stringify(imageSpecs.map((spec, idx) => ({
  index: idx,
  title: spec.title,
  subtitle: spec.subtitle,
  asset: spec.asset,
  initialLogoRequested: spec.logo_requested,
  initialLogoNames: spec.logo_names
})), null, 2)}

For EACH image specification, analyze and return:
1. logos: Array of logo objects, each with:
   - canonicalKey: The exact key from the AVAILABLE LOGOS list (e.g., "intel-core", "nvidia-50-series")
   - position: One of "top-left", "top-right", "bottom-left", "bottom-right"
   - sizePercent: Recommended width as percentage of image (6-12)
   - confidence: How confident you are in this match (0.0-1.0)
   - reason: Brief explanation of why this logo was identified

2. If NO logos are required, return an empty array for logos

Return ONLY a valid JSON array with one object per image specification:
[
  {
    "specIndex": 0,
    "logos": [
      {
        "canonicalKey": "intel-core-ultra",
        "position": "bottom-left",
        "sizePercent": 8,
        "confidence": 0.95,
        "reason": "Subtitle mentions 'Intel Core Ultra 9'"
      },
      {
        "canonicalKey": "nvidia-50-series",
        "position": "bottom-right",
        "sizePercent": 7,
        "confidence": 0.90,
        "reason": "NOTES column mentions 'NVIDIA 50 Series logo'"
      }
    ]
  },
  {
    "specIndex": 1,
    "logos": []
  }
]`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0].message.content.trim();
    console.log('[LogoAnalyzer] AI response received, parsing...');

    let analysisResult;
    try {
      const parsed = JSON.parse(responseText);
      analysisResult = parsed.specifications || parsed.results || parsed;
      
      if (!Array.isArray(analysisResult)) {
        if (parsed.specifications) analysisResult = parsed.specifications;
        else if (Array.isArray(Object.values(parsed)[0])) analysisResult = Object.values(parsed)[0];
        else analysisResult = [parsed];
      }
    } catch (parseError) {
      console.error('[LogoAnalyzer] JSON parse error:', parseError.message);
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    console.log(`[LogoAnalyzer] Successfully analyzed ${analysisResult.length} specifications`);

    const validatedPlans = analysisResult.map((plan, idx) => {
      const validatedLogos = (plan.logos || [])
        .filter(logo => {
          if (!CANONICAL_LOGO_REGISTRY[logo.canonicalKey]) {
            console.warn(`[LogoAnalyzer] Unknown canonical key: ${logo.canonicalKey}`);
            return false;
          }
          if (logo.confidence < 0.5) {
            console.warn(`[LogoAnalyzer] Low confidence logo skipped: ${logo.canonicalKey} (${logo.confidence})`);
            return false;
          }
          return true;
        })
        .map(logo => ({
          canonicalKey: logo.canonicalKey,
          displayName: CANONICAL_LOGO_REGISTRY[logo.canonicalKey].displayName,
          localPath: CANONICAL_LOGO_REGISTRY[logo.canonicalKey].localPath,
          position: PLACEMENT_POSITIONS.includes(logo.position) ? logo.position : 'bottom-left',
          sizePercent: Math.min(15, Math.max(5, logo.sizePercent || 8)),
          confidence: logo.confidence,
          reason: logo.reason
        }));

      return {
        specIndex: plan.specIndex ?? idx,
        logos: validatedLogos,
        hasLogos: validatedLogos.length > 0
      };
    });

    let totalLogos = 0;
    validatedPlans.forEach((plan, idx) => {
      if (plan.logos.length > 0) {
        console.log(`[LogoAnalyzer] Spec ${idx}: ${plan.logos.length} logo(s)`);
        plan.logos.forEach(logo => {
          console.log(`  - ${logo.displayName} at ${logo.position} (${logo.sizePercent}%, confidence: ${logo.confidence})`);
          console.log(`    Reason: ${logo.reason}`);
        });
        totalLogos += plan.logos.length;
      } else {
        console.log(`[LogoAnalyzer] Spec ${idx}: No logos`);
      }
    });

    console.log(`[LogoAnalyzer] Analysis complete: ${totalLogos} total logos across ${validatedPlans.length} specs`);

    return validatedPlans;

  } catch (error) {
    console.error('[LogoAnalyzer] AI analysis failed:', error.message);
    
    console.log('[LogoAnalyzer] Falling back to rule-based matching...');
    return imageSpecs.map((spec, idx) => ({
      specIndex: idx,
      logos: [],
      hasLogos: false,
      fallback: true
    }));
  }
}

/**
 * Merge AI logo analysis results into image specs
 * @param {Array} imageSpecs - Original image specifications
 * @param {Array} logoPlans - Logo placement plans from AI analysis
 * @returns {Array} Enhanced image specs with logo placement data
 */
export function mergeLogoPlansIntoSpecs(imageSpecs, logoPlans) {
  console.log('[LogoAnalyzer] Merging logo plans into image specs...');
  
  // Handle null/undefined/empty inputs gracefully
  if (!imageSpecs || !Array.isArray(imageSpecs)) {
    console.warn('[LogoAnalyzer] No image specs to merge');
    return [];
  }
  
  if (!logoPlans || !Array.isArray(logoPlans) || logoPlans.length === 0) {
    console.log('[LogoAnalyzer] No logo plans to merge, returning original specs');
    return imageSpecs;
  }
  
  return imageSpecs.map((spec, idx) => {
    const plan = logoPlans.find(p => p.specIndex === idx) || { logos: [], hasLogos: false };
    
    return {
      ...spec,
      logo_plan: {
        logos: plan.logos || [],
        hasLogos: plan.hasLogos || false,
        analyzedByAI: !plan.fallback
      },
      logo_requested: plan.hasLogos || spec.logo_requested,
      ai_logo_names: (plan.logos || []).map(l => l.displayName)
    };
  });
}

/**
 * Get canonical logo info by key
 */
export function getCanonicalLogo(canonicalKey) {
  return CANONICAL_LOGO_REGISTRY[canonicalKey] || null;
}

/**
 * Get all available canonical logos
 */
export function getAllCanonicalLogos() {
  return Object.entries(CANONICAL_LOGO_REGISTRY).map(([key, info]) => ({
    key,
    ...info
  }));
}

export default {
  analyzeLogoPlacement,
  mergeLogoPlansIntoSpecs,
  getCanonicalLogo,
  getAllCanonicalLogos,
  CANONICAL_LOGO_REGISTRY,
  PLACEMENT_POSITIONS
};
