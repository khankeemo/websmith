// API Configuration
// Centralizes all API endpoints
// ============================================

export const API_CONFIG = {
  // Backend URL - from environment only (lazy, evaluated at call time)
  get backendUrl(): string {
    const url = process.env.NEXT_PUBLIC_API_URL;
    if (!url) throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
    return url;
  },
  
  // Endpoints - All paths now point to Render API structure
  endpoints: {
    // Admin endpoints (Dashboard & Management)
    admin: {
      dashboard: "/internal/api/dashboard/metrics",   // ✅ Render API path
      products: "/internal/api/products",             // ✅ Render API path
      licenses: "/internal/api/licenses",             // ✅ Render API path
      hardware: "/internal/api/hardware",             // ✅ Render API path
      trials: "/internal/api/trials",                 // ✅ Render API path
      logs: "/internal/api/logs/activations",         // ✅ Render API path
    },
    
    // License endpoints (for desktop app validation)
    license: {
      validate: "/internal/api/licenses/validate",    // ✅ Render API path
      activate: "/internal/api/licenses/activate",    // ✅ Render API path
      reset: "/internal/api/licenses/reset",          // ✅ Render API path
      info: "/internal/api/licenses/info",            // ✅ Render API path
      status: "/internal/backend/license/status",     // ✅ AWS-01 License Status Endpoint
    },
    
    // Trial endpoints
    trial: {
      start: "/internal/api/trials/start",            // ✅ Render API path
      status: "/internal/api/trials/status",          // ✅ Render API path
    },
    
    // System health check
    health: "/internal/api/health",                    // ✅ Render API path
  },
  
  // Default request options
  defaults: {
    timeout: 30000,    // 30 seconds
    retries: 3,
  },
};

// Helper function to get full API URL
// Example: getApiUrl("/internal/api/products")
export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.backendUrl}${endpoint}`;
}