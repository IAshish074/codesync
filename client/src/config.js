const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// If VITE_BACKEND_URL env is set (e.g. on Vercel pointing to Railway), use it.
// Otherwise, default to localhost Gateway (5000) or current host.
const BASE_URL = import.meta.env.VITE_BACKEND_URL || (isLocal ? 'http://localhost:5000' : `${window.location.protocol}//${window.location.host}`);

export const AUTH_SERVICE_URL = BASE_URL;
export const SNIPPET_SERVICE_URL = BASE_URL;
export const COLLAB_SERVICE_URL = BASE_URL;
