/**
 * Utility for making authenticated API calls
 * Automatically includes brand or admin tokens from localStorage
 */

import { getApiUrl } from '../config/api.js';

function getAuthHeaders() {
  const headers = {};
  
  // Check for brand token (from brand login)
  const brandToken = localStorage.getItem('brandToken');
  if (brandToken) {
    headers['Authorization'] = `Bearer ${brandToken}`;
  }
  
  // Check for admin token (from admin login)
  const adminToken = localStorage.getItem('adminToken');
  if (adminToken) {
    headers['X-Admin-Key'] = adminToken;
  }
  
  return headers;
}

/**
 * Enhanced fetch with automatic authentication
 * @param {string} url - The URL to fetch (will be converted to full API URL)
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
  const authHeaders = getAuthHeaders();
  
  // Merge auth headers with provided headers
  const mergedOptions = {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers
    }
  };
  
  // Convert to full API URL
  const apiUrl = getApiUrl(url);
  return fetch(apiUrl, mergedOptions);
}

/**
 * Helper for JSON POST requests with authentication
 */
export async function postJSON(url, data) {
  return authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}

/**
 * Helper for FormData POST requests with authentication
 */
export async function postFormData(url, formData) {
  return authenticatedFetch(url, {
    method: 'POST',
    body: formData
  });
}

/**
 * Helper for GET requests with authentication
 */
export async function getJSON(url) {
  const response = await authenticatedFetch(url);
  return response.json();
}

export default {
  authenticatedFetch,
  postJSON,
  postFormData,
  getJSON
};
