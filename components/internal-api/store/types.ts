export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  version: string;
  latest_version: string;
  price: number;
  is_active: boolean;
  is_deleted: boolean;
  company_name: string;
  product_type: string;
  website: string;
  created_at: string;
  updated_at?: string;
}

export interface PlanInfo {
  id: number;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  max_devices: number;
  is_trial_plan: boolean;
  is_active: boolean;
  features: string[];
}

export interface ProductStats {
  total_plans: number;
  active_plans: number;
  trial_plans: number;
  sdk_support: boolean;
  api_support: boolean;
  api_keys: number;
  has_release_notes: boolean;
}

export const PRODUCT_TYPE_GRADIENTS: Record<string, string> = {
  'Software': 'from-blue-600 via-blue-500 to-cyan-400',
  'SaaS': 'from-purple-600 via-violet-500 to-pink-400',
  'API': 'from-emerald-600 via-green-500 to-teal-400',
  'Desktop App': 'from-orange-600 via-amber-500 to-yellow-400',
  'Web App': 'from-indigo-600 via-blue-500 to-violet-400',
  'Mobile App': 'from-pink-600 via-rose-500 to-red-400',
  'Plugin': 'from-teal-600 via-cyan-500 to-sky-400',
  'Extension': 'from-violet-600 via-purple-500 to-fuchsia-400',
};

export const getGradient = (type: string) => PRODUCT_TYPE_GRADIENTS[type] || 'from-slate-600 via-gray-500 to-zinc-400';

export const PLATFORM_ICONS: Record<string, string> = {
  python: '🐍', node: '🟢', php: '🐘', java: '☕',
  dotnet: '🔷', go: '🐹', rust: '🦀', cpp: '⚡',
  c: '🔧', javascript: '📜', typescript: '📘',
};
