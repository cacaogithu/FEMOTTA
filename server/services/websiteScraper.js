import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

/**
 * Scrapes a website and extracts brand information using AI
 * @param {string} websiteUrl - The URL to scrape
 * @param {string} openaiApiKey - OpenAI API key for analysis
 * @returns {Promise<Object>} Brand information including colors, logo, name
 */
export async function scrapeWebsiteForBranding(websiteUrl, openaiApiKey) {
  try {
    // Fetch the website HTML
    const response = await axios.get(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract metadata
    const title = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || '';
    
    // Find logo images
    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[class*="logo" i]',
      'img[id*="logo" i]',
      '.header img',
      '.navbar img',
      'header img'
    ];
    
    let logoUrl = '';
    for (const selector of logoSelectors) {
      const img = $(selector).first();
      if (img.length) {
        logoUrl = img.attr('src') || '';
        if (logoUrl && !logoUrl.startsWith('http')) {
          const baseUrl = new URL(websiteUrl).origin;
          logoUrl = new URL(logoUrl, baseUrl).href;
        }
        if (logoUrl) break;
      }
    }

    // Extract color information from CSS
    const styleText = $('style').text();
    const inlineStyles = $('[style]').map((i, el) => $(el).attr('style')).get().join(' ');
    const colorMatches = (styleText + ' ' + inlineStyles).match(/#[0-9A-Fa-f]{6}/g) || [];
    const uniqueColors = [...new Set(colorMatches)].slice(0, 10);

    // Get visible text for context
    const bodyText = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    // Use OpenAI to analyze and extract brand information
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const analysisPrompt = `Analyze this website and extract brand information:

Website Title: ${title}
Description: ${description}
Found Colors: ${uniqueColors.join(', ')}
Logo URL: ${logoUrl}
Body Text Sample: ${bodyText.slice(0, 500)}

Extract the following:
1. Brand Name (clean, proper capitalization)
2. Primary Brand Color (hex code - choose the most prominent brand color)
3. Secondary Brand Color (hex code - choose a complementary accent color)
4. Slug (lowercase, hyphenated version of brand name)
5. Display Name (how the brand should be displayed in UI)

Respond in JSON format:
{
  "name": "BRAND_NAME",
  "displayName": "Brand Name",
  "slug": "brand-name",
  "primaryColor": "#RRGGBB",
  "secondaryColor": "#RRGGBB",
  "logoUrl": "${logoUrl}"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a brand analysis expert. Extract brand information and return valid JSON only.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const brandInfo = JSON.parse(completion.choices[0].message.content);

    return {
      success: true,
      brandInfo: {
        ...brandInfo,
        websiteUrl
      }
    };

  } catch (error) {
    console.error('Website scraping error:', error);
    return {
      success: false,
      error: error.message,
      brandInfo: null
    };
  }
}
