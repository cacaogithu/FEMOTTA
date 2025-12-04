/**
 * Vision-Based Logo Placement Analyzer
 * 
 * Uses GPT-4o Vision to analyze actual product images and determine:
 * 1. Optimal logo placement positions based on image composition
 * 2. Which corners have space for logos (avoiding product/text areas)
 * 3. Appropriate sizing based on image dimensions
 * 
 * This replaces the text-only approach with actual visual analysis.
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

const VISION_SYSTEM_PROMPT = `You are an expert marketing image analyst with computer vision capabilities. Your task is to analyze product images and determine the optimal placement for partner logos.

ANALYSIS PROCESS:
1. Examine the image composition - where is the main product/subject?
2. Identify empty/dark areas suitable for logo placement
3. Avoid placing logos over the product, text, or important visual elements
4. Consider the image's visual balance and professional appearance

PLACEMENT RULES:
- bottom-left: Most common, good for most images
- bottom-right: Secondary position, use when bottom-left is obstructed
- top-left: Use when bottom corners are busy or product extends downward
- top-right: Use as last resort or for symmetry with top-left

SCORING EACH CORNER (0-100):
- 100: Completely empty, dark gradient, perfect for logo
- 80-99: Mostly clear with minimal interference
- 50-79: Partially obstructed but usable
- 20-49: Significant obstruction, not ideal
- 0-19: Product/text covers this area, unusable

Return your analysis as a JSON object.`;

/**
 * Identify existing logos/brands already visible in the image
 * @param {string} imageUrl - Public URL of the image
 * @param {Object} openai - OpenAI client instance
 * @returns {Promise<Array>} Array of canonical logo keys already in image
 */
async function identifyExistingLogos(imageUrl, openai) {
  const prompt = `Analyze this image and identify ANY visible logos or brand elements (Intel, AMD, NVIDIA, Corsair, etc).

Look for:
- CPU/GPU brand logos (Intel, AMD, NVIDIA)
- Corsair branding or products
- Component brand logos
- Text mentioning brands

List ONLY the canonical brand names you see, nothing else.

Examples of format:
- "intel-core"
- "nvidia-50-series"
- "amd-ryzen"

If you see an Intel logo, respond with: ["intel-core"] or ["intel-core-ultra"]
If you see NVIDIA RTX 5090, respond with: ["nvidia-50-series"]
If you see AMD, respond with: ["amd-ryzen"]
If you see nothing relevant, respond with: []

Respond ONLY with a JSON array of canonical keys.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image_url', 
              image_url: { 
                url: imageUrl,
                detail: 'low'
              }
            }
          ]
        }
      ],
      max_tokens: 200,
      temperature: 0.1
    });

    const responseText = response.choices[0].message.content.trim();
    const arrayMatch = responseText.match(/\[[\s\S]*?\]/);
    
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    return [];
  } catch (error) {
    console.warn(`[VisionLogoAnalyzer] Error identifying existing logos: ${error.message}`);
    return [];
  }
}

/**
 * Analyze a single image with GPT-4o Vision to determine logo placement
 * @param {string} imageUrl - Public URL of the image to analyze
 * @param {Object} spec - The image specification (title, subtitle, etc.)
 * @param {Array} candidateLogos - Logo canonical keys that might be placed
 * @param {Object} openai - OpenAI client instance
 * @returns {Promise<Object>} Placement analysis for this image
 */
async function analyzeImageWithVision(imageUrl, spec, candidateLogos, openai) {
  // First: Identify what logos/brands are already in the image
  console.log(`[VisionLogoAnalyzer] Checking for existing logos in image...`);
  const existingLogos = await identifyExistingLogos(imageUrl, openai);
  console.log(`[VisionLogoAnalyzer] Existing logos detected: ${existingLogos.length > 0 ? existingLogos.join(', ') : 'None'}`);
  
  // Filter out candidates that are already in the image
  const logosToPlace = candidateLogos.filter(logo => !existingLogos.includes(logo));
  
  if (logosToPlace.length === 0) {
    console.log(`[VisionLogoAnalyzer] All candidate logos already exist in image, skipping placement`);
    return {
      cornerScores: { 'top-left': 0, 'top-right': 0, 'bottom-left': 0, 'bottom-right': 0 },
      bestPositions: [],
      recommendedSize: 8,
      imageDescription: 'Image already contains all candidate logos',
      placementNotes: 'No new logos needed for this image',
      existingLogos: existingLogos,
      skipped: true
    };
  }
  
  const userPrompt = `Analyze this marketing product image and determine optimal logo placement for NEW logos (not ones already in the image).

IMAGE CONTEXT:
- Title: "${spec.title || 'N/A'}"
- Subtitle: "${spec.subtitle || 'N/A'}"
- Logos already in image: ${existingLogos.length > 0 ? existingLogos.join(', ') : 'None'}
- NEW logos to place: ${logosToPlace.join(', ')}

TASK:
1. Examine the image visually
2. Note where existing logos are positioned (top-left, etc)
3. Score each corner (0-100) for NEW logo placement, avoiding existing logos
4. Recommend the best corners for the new logos
5. Suggest appropriate logo size (5-12% of image width)

Return ONLY a valid JSON object:
{
  "cornerScores": {
    "top-left": <0-100>,
    "top-right": <0-100>,
    "bottom-left": <0-100>,
    "bottom-right": <0-100>
  },
  "bestPositions": ["<best corner>", "<second best>"],
  "recommendedSize": <5-12>,
  "imageDescription": "<brief description of what's in the image>",
  "placementNotes": "<any special notes about logo placement for this image>"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { 
              type: 'image_url', 
              image_url: { 
                url: imageUrl,
                detail: 'low'
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.2
    });

    const responseText = response.choices[0].message.content.trim();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Could not parse vision response as JSON');
  } catch (error) {
    console.error(`[VisionLogoAnalyzer] Error analyzing image: ${error.message}`);
    return {
      cornerScores: {
        'top-left': 60,
        'top-right': 60,
        'bottom-left': 80,
        'bottom-right': 70
      },
      bestPositions: ['bottom-left', 'bottom-right'],
      recommendedSize: 8,
      imageDescription: 'Analysis failed - using defaults',
      placementNotes: 'Fallback to standard placement'
    };
  }
}

/**
 * Detect logo requirements from spec metadata and brief text
 * @param {Object} spec - Image specification
 * @param {string} briefText - Full brief text to search for logo mentions
 * @returns {Array} Array of canonical logo keys that should be placed
 */
function detectLogosFromSpec(spec, briefText = '') {
  const detectedLogos = [];
  const specText = `${spec.title || ''} ${spec.subtitle || ''} ${spec.asset || ''} ${spec.notes || ''}`;
  const searchText = `${specText} ${briefText}`.toLowerCase();
  
  const logoPatterns = [
    { pattern: /intel\s*core\s*ultra/i, key: 'intel-core-ultra' },
    { pattern: /intel\s*core|intel.*processor/i, key: 'intel-core' },
    { pattern: /amd\s*ryzen|ryzen\s*9000|ryzen\s*9/i, key: 'amd-ryzen' },
    { pattern: /nvidia\s*(50|5090|5080)|rtx\s*(50|5090|5080)|5090|5080/i, key: 'nvidia-50-series' },
    { pattern: /nvidia|geforce|rtx/i, key: 'nvidia' },
    { pattern: /hydro\s*x.*icue|icue.*hydro\s*x|hydro-x\s*&.*icue|hydro-x.*iCUE/i, key: 'hydro-x-icue-link' },
    { pattern: /hydro\s*x|hydro-x|liquid\s*cool|cooling.*hydro|dual.*liquid/i, key: 'hydro-x' },
    { pattern: /icue\s*link|icue-link|i.cue/i, key: 'icue-link' },
    { pattern: /origin\s*pc|originpc/i, key: 'origin-pc' },
    { pattern: /corsair/i, key: 'corsair' }
  ];
  
  for (const { pattern, key } of logoPatterns) {
    if (pattern.test(searchText) && !detectedLogos.includes(key)) {
      if (key === 'intel-core' && detectedLogos.includes('intel-core-ultra')) continue;
      if (key === 'nvidia' && detectedLogos.includes('nvidia-50-series')) continue;
      if (key === 'hydro-x' && detectedLogos.includes('hydro-x-icue-link')) continue;
      if (key === 'icue-link' && detectedLogos.includes('hydro-x-icue-link')) continue;
      
      detectedLogos.push(key);
    }
  }
  
  return detectedLogos;
}

/**
 * Analyze uploaded images with vision AI to determine logo placement
 * @param {Array} uploadedImages - Array of {id, publicUrl, ...} from Drive upload
 * @param {Array} imageSpecs - Array of image specifications from DOCX extraction
 * @param {string} briefText - The full brief text from DOCX for logo detection
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Array of placement plans for each image
 */
export async function analyzeImagesWithVision(uploadedImages, imageSpecs, briefText = '', options = {}) {
  const openai = new OpenAI({
    apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY
  });

  console.log('[VisionLogoAnalyzer] Starting vision-based logo placement analysis...');
  console.log(`[VisionLogoAnalyzer] Analyzing ${uploadedImages.length} images`);

  const placementPlans = [];
  
  for (let i = 0; i < uploadedImages.length; i++) {
    const image = uploadedImages[i];
    const spec = imageSpecs[i % imageSpecs.length] || {};
    
    console.log(`[VisionLogoAnalyzer] Analyzing image ${i + 1}/${uploadedImages.length}: ${spec.title || 'Untitled'}`);
    
    const candidateLogos = detectLogosFromSpec(spec, briefText);
    console.log(`[VisionLogoAnalyzer] Detected candidate logos for spec: ${candidateLogos.join(', ') || 'None'}`);
    
    if (candidateLogos.length === 0) {
      placementPlans.push({
        imageIndex: i,
        imageId: image.id,
        hasLogos: false,
        logos: [],
        visionAnalysis: null
      });
      continue;
    }
    
    const visionAnalysis = await analyzeImageWithVision(
      image.publicUrl,
      spec,
      candidateLogos,
      openai
    );
    
    // Skip if all logos already exist in image
    if (visionAnalysis.skipped) {
      console.log(`[VisionLogoAnalyzer] Skipping image ${i + 1} - all candidate logos already present`);
      placementPlans.push({
        imageIndex: i,
        imageId: image.id,
        hasLogos: false,
        logos: [],
        visionAnalysis: {
          cornerScores: visionAnalysis.cornerScores,
          description: visionAnalysis.imageDescription,
          notes: visionAnalysis.placementNotes,
          existingLogos: visionAnalysis.existingLogos
        }
      });
      continue;
    }
    
    console.log(`[VisionLogoAnalyzer] Vision analysis for image ${i + 1}:`);
    console.log(`  - Best positions: ${visionAnalysis.bestPositions?.join(', ') || 'N/A'}`);
    console.log(`  - Recommended size: ${visionAnalysis.recommendedSize}%`);
    
    const logosToPlace = candidateLogos.filter(logo => !visionAnalysis.existingLogos?.includes(logo));
    
    const logoAssignments = logosToPlace.map((logoKey, idx) => {
      const position = visionAnalysis.bestPositions?.[idx] || PLACEMENT_POSITIONS[idx % 4];
      const score = visionAnalysis.cornerScores?.[position] || 50;
      
      return {
        canonicalKey: logoKey,
        displayName: CANONICAL_LOGO_REGISTRY[logoKey]?.displayName || logoKey,
        localPath: CANONICAL_LOGO_REGISTRY[logoKey]?.localPath,
        position: position,
        sizePercent: visionAnalysis.recommendedSize || 8,
        cornerScore: score,
        assignedByVision: true
      };
    });
    
    placementPlans.push({
      imageIndex: i,
      imageId: image.id,
      hasLogos: logoAssignments.length > 0,
      logos: logoAssignments,
      visionAnalysis: {
        cornerScores: visionAnalysis.cornerScores,
        description: visionAnalysis.imageDescription,
        notes: visionAnalysis.placementNotes,
        existingLogos: visionAnalysis.existingLogos
      }
    });
    
    console.log(`[VisionLogoAnalyzer] Assigned ${logoAssignments.length} logos to image ${i + 1}`);
  }

  const totalLogos = placementPlans.reduce((sum, p) => sum + p.logos.length, 0);
  console.log(`[VisionLogoAnalyzer] Analysis complete: ${totalLogos} logos across ${placementPlans.length} images`);

  return placementPlans;
}

/**
 * Merge vision-analyzed placement plans into the job's logo configuration
 * This updates the imageSpecs with proper logo_plan data
 * 
 * Output format matches what overlayMultipleLogos expects:
 * {
 *   analyzedByAI: true,
 *   logos: [{ displayName, canonicalKey, position, sizePercent, localPath }]
 * }
 */
export function mergeVisionPlansIntoSpecs(imageSpecs, visionPlans) {
  console.log('[VisionLogoAnalyzer] Merging vision plans into image specs...');
  
  return imageSpecs.map((spec, idx) => {
    const plan = visionPlans.find(p => p.imageIndex === idx);
    
    if (!plan || !plan.hasLogos) {
      return spec;
    }
    
    // Format that overlayMultipleLogos expects
    const logoPlanObj = {
      analyzedByAI: true,
      visionAnalyzed: true,
      logos: plan.logos.map(logo => ({
        displayName: logo.displayName,
        name: logo.displayName,
        canonicalKey: logo.canonicalKey,
        position: logo.position,
        sizePercent: logo.sizePercent,
        localPath: logo.localPath,
        visionScore: logo.cornerScore
      }))
    };
    
    console.log(`[VisionLogoAnalyzer] Spec ${idx}: ${logoPlanObj.logos.length} logos assigned`);
    
    return {
      ...spec,
      logo_requested: true,
      logo_names: plan.logos.map(l => l.displayName),
      logo_plan: logoPlanObj,
      vision_analyzed: true
    };
  });
}

export { CANONICAL_LOGO_REGISTRY };
