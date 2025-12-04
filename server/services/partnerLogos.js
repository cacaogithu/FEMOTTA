/**
 * Partner Logos Registry
 * Maps logo names to their Google Drive file IDs or local paths
 * 
 * This registry is used to match AI-extracted logo_name values to actual logo files
 */

const PARTNER_LOGOS = {
  'intel core': {
    name: 'Intel Core',
    keywords: ['intel', 'core', 'intel core', 'intel®', 'core™'],
    driveId: null,
    localPath: 'assets/logos/intel-core.png',
    variants: {
      'default': { driveId: null },
      'white': { driveId: null },
      'dark': { driveId: null }
    }
  },
  'intel core ultra': {
    name: 'Intel Core Ultra',
    keywords: ['intel core ultra', 'core ultra', 'intel® core™ ultra', 'ultra'],
    driveId: null,
    localPath: 'assets/logos/intel-core-ultra.png',
    variants: {}
  },
  'amd ryzen': {
    name: 'AMD Ryzen',
    keywords: ['amd', 'ryzen', 'amd ryzen', 'ryzen 9000', 'ryzen 9'],
    driveId: null,
    localPath: 'assets/logos/amd-ryzen.png',
    variants: {}
  },
  'nvidia': {
    name: 'NVIDIA',
    keywords: ['nvidia', 'geforce', 'rtx', 'nvidia geforce'],
    driveId: null,
    localPath: 'assets/logos/nvidia.png',
    variants: {}
  },
  'nvidia 50 series': {
    name: 'NVIDIA 50 Series',
    keywords: ['nvidia 50', '50 series', '5090', '5080', 'nvidia 5090', 'nvidia 5080', '50-series'],
    driveId: null,
    localPath: 'assets/logos/nvidia-50-series.png',
    variants: {}
  },
  'hydro x': {
    name: 'Hydro X',
    keywords: ['hydro x', 'hydro-x', 'hydro series', 'hydro-series', 'custom liquid cooling', 'liquid cooling'],
    driveId: null,
    localPath: 'assets/logos/hydro-x.png',
    variants: {}
  },
  'icue link': {
    name: 'iCUE Link',
    keywords: ['icue', 'icue link', 'icue-link', 'i-cue'],
    driveId: null,
    localPath: 'assets/logos/icue-link.png',
    variants: {}
  },
  'corsair': {
    name: 'Corsair',
    keywords: ['corsair', 'corsair gaming'],
    driveId: null,
    localPath: 'assets/logos/corsair.png',
    variants: {}
  },
  'origin pc': {
    name: 'Origin PC',
    keywords: ['origin', 'origin pc', 'originpc'],
    driveId: null,
    localPath: 'assets/logos/origin-pc.png',
    variants: {}
  }
};

/**
 * Normalize a logo name for matching
 */
function normalizeLogoName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate match score between search term and logo entry
 * Higher score = better match
 */
function calculateMatchScore(searchTerm, logoEntry) {
  const normalizedSearch = normalizeLogoName(searchTerm);
  const normalizedName = normalizeLogoName(logoEntry.name);
  
  let score = 0;
  
  if (normalizedSearch === normalizedName) {
    score = 100;
  } else if (normalizedName.includes(normalizedSearch)) {
    score = 80;
  } else if (normalizedSearch.includes(normalizedName)) {
    score = 70;
  }
  
  for (const keyword of logoEntry.keywords) {
    const normalizedKeyword = normalizeLogoName(keyword);
    if (normalizedSearch === normalizedKeyword) {
      score = Math.max(score, 95);
    } else if (normalizedSearch.includes(normalizedKeyword)) {
      score = Math.max(score, 60);
    } else if (normalizedKeyword.includes(normalizedSearch)) {
      score = Math.max(score, 50);
    }
  }
  
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
  const matchingWords = searchWords.filter(word => 
    logoEntry.keywords.some(kw => normalizeLogoName(kw).includes(word)) ||
    normalizedName.includes(word)
  );
  
  if (matchingWords.length > 0 && score < 40) {
    score = Math.max(score, 30 + (matchingWords.length * 10));
  }
  
  return score;
}

/**
 * Find the best matching logo for a given logo name
 * Returns the logo entry with match score, or null if no match found
 */
export function findLogoByName(logoName, minScore = 30) {
  if (!logoName) return null;
  
  const normalizedSearch = normalizeLogoName(logoName);
  console.log(`[PartnerLogos] Searching for logo: "${logoName}" (normalized: "${normalizedSearch}")`);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [key, entry] of Object.entries(PARTNER_LOGOS)) {
    const score = calculateMatchScore(logoName, entry);
    
    if (score > bestScore && score >= minScore) {
      bestScore = score;
      bestMatch = { key, ...entry, matchScore: score };
    }
  }
  
  if (bestMatch) {
    console.log(`[PartnerLogos] Found match: "${bestMatch.name}" (score: ${bestScore})`);
  } else {
    console.log(`[PartnerLogos] No match found for "${logoName}" (best score was below threshold: ${minScore})`);
  }
  
  return bestMatch;
}

/**
 * Check if a text mentions any partner logos
 * Returns array of detected logo mentions with their positions
 */
export function detectLogosInText(text) {
  if (!text) return [];
  
  const normalizedText = normalizeLogoName(text);
  const detectedLogos = [];
  
  for (const [key, entry] of Object.entries(PARTNER_LOGOS)) {
    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeLogoName(keyword);
      if (normalizedText.includes(normalizedKeyword)) {
        const existing = detectedLogos.find(d => d.key === key);
        if (!existing) {
          detectedLogos.push({
            key,
            name: entry.name,
            keyword: keyword,
            matchedIn: text
          });
        }
        break;
      }
    }
  }
  
  return detectedLogos;
}

/**
 * Update a logo's Drive ID in the registry
 * This can be called to dynamically update logos from Drive
 */
export function updateLogoDriveId(logoKey, driveId) {
  const normalizedKey = normalizeLogoName(logoKey);
  
  for (const [key, entry] of Object.entries(PARTNER_LOGOS)) {
    if (normalizeLogoName(key) === normalizedKey || 
        normalizeLogoName(entry.name) === normalizedKey) {
      PARTNER_LOGOS[key].driveId = driveId;
      console.log(`[PartnerLogos] Updated ${entry.name} with Drive ID: ${driveId}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Get all registered partner logos
 */
export function getAllPartnerLogos() {
  return Object.entries(PARTNER_LOGOS).map(([key, entry]) => ({
    key,
    ...entry
  }));
}

/**
 * Register a new partner logo
 */
export function registerPartnerLogo(key, config) {
  const normalizedKey = normalizeLogoName(key);
  PARTNER_LOGOS[normalizedKey] = {
    name: config.name || key,
    keywords: config.keywords || [normalizedKey],
    driveId: config.driveId || null,
    localPath: config.localPath || null,
    variants: config.variants || {}
  };
  console.log(`[PartnerLogos] Registered new logo: ${config.name || key}`);
}

export default {
  findLogoByName,
  detectLogosInText,
  updateLogoDriveId,
  getAllPartnerLogos,
  registerPartnerLogo,
  PARTNER_LOGOS
};
