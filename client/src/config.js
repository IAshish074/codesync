// Point the frontend to your live, deployed Railway API Gateway.
// You can also override this by setting the VITE_BACKEND_URL environment variable during build.
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://codesync-production-983a.up.railway.app';

export const AUTH_SERVICE_URL = BASE_URL;
export const SNIPPET_SERVICE_URL = BASE_URL;
export const COLLAB_SERVICE_URL = BASE_URL;
