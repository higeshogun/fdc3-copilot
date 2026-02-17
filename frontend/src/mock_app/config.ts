// API Configuration
// Automatically uses the current domain in production (Cloudflare),
// falls back to localhost:5500 for local development

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_BASE_URL = isLocal
    ? 'http://localhost:5500' // Development: use local backend
    : window.location.origin;  // Production: use current domain
