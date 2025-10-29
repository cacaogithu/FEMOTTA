// API configuration for backend communication
// Use relative paths in all environments - Vite proxy handles dev, backend serves in prod

// Helper to construct API URLs (always relative - proxy handles routing)
export function getApiUrl(path) {
  // Always use relative paths - Vite proxy forwards to backend in dev
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanPath;
}

// Deprecated - kept for backwards compatibility
export function getApiBaseUrl() {
  return '';
}

export default {
  getApiBaseUrl,
  getApiUrl
};
