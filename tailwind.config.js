// FILE: D:\websmith\tailwind.config.js
// PURPOSE: Tailwind CSS configuration for Websmith project
// FIX: Added CSS variable mappings for API Center theme

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Existing paths
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    // CRITICAL: Add internal-api components
    "./components/internal-api/**/*.{js,ts,jsx,tsx}",
    // Also ensure internal API routes are scanned
    "./app/internal/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ============================================================
        // API CENTER THEME COLORS - Maps to CSS variables
        // These will change when .dark-theme class is applied
        // ============================================================
        
        // Background colors
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        
        // Text colors
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        
        // Border colors
        'border-color': 'var(--border-color)',
        
        // Card shadow
        'card-shadow': 'var(--card-shadow)',
        
        // ============================================================
        // BRAND COLORS WITH OPACITY - These also need CSS variables
        // ============================================================
        
        // Blue
        'api-blue': {
          500: 'var(--api-blue-500)',
          400: 'var(--api-blue-400)',
          '500/5': 'var(--api-blue-500-5)',
          '500/10': 'var(--api-blue-500-10)',
          '500/20': 'var(--api-blue-500-20)',
          '500/30': 'var(--api-blue-500-30)',
        },
        
        // Green
        'api-green': {
          500: 'var(--api-green-500)',
          400: 'var(--api-green-400)',
          '500/5': 'var(--api-green-500-5)',
          '500/10': 'var(--api-green-500-10)',
          '500/20': 'var(--api-green-500-20)',
        },
        
        // Purple
        'api-purple': {
          500: 'var(--api-purple-500)',
          400: 'var(--api-purple-400)',
          '500/5': 'var(--api-purple-500-5)',
          '500/10': 'var(--api-purple-500-10)',
          '500/20': 'var(--api-purple-500-20)',
        },
        
        // Cyan
        'api-cyan': {
          500: 'var(--api-cyan-500)',
          400: 'var(--api-cyan-400)',
          '500/5': 'var(--api-cyan-500-5)',
          '500/10': 'var(--api-cyan-500-10)',
          '500/20': 'var(--api-cyan-500-20)',
        },
        
        // Amber
        'api-amber': {
          500: 'var(--api-amber-500)',
          400: 'var(--api-amber-400)',
          '500/5': 'var(--api-amber-500-5)',
          '500/10': 'var(--api-amber-500-10)',
          '500/20': 'var(--api-amber-500-20)',
        },
        
        // Red
        'api-red': {
          500: 'var(--api-red-500)',
          400: 'var(--api-red-400)',
          '500/5': 'var(--api-red-500-5)',
          '500/10': 'var(--api-red-500-10)',
          '500/20': 'var(--api-red-500-20)',
        },
        
        // Pink
        'api-pink': {
          500: 'var(--api-pink-500)',
          400: 'var(--api-pink-400)',
          '500/5': 'var(--api-pink-500-5)',
          '500/10': 'var(--api-pink-500-10)',
          '500/20': 'var(--api-pink-500-20)',
        },
        
        // Indigo
        'api-indigo': {
          500: 'var(--api-indigo-500)',
          400: 'var(--api-indigo-400)',
          '500/5': 'var(--api-indigo-500-5)',
          '500/10': 'var(--api-indigo-500-10)',
          '500/20': 'var(--api-indigo-500-20)',
        },
        
        // ============================================================
        // COMPATIBILITY: Map old color names to API colors
        // So you can keep using bg-blue-500/10 in your code
        // ============================================================
        blue: {
          400: 'var(--api-blue-400)',
          500: 'var(--api-blue-500)',
          '500/5': 'var(--api-blue-500-5)',
          '500/10': 'var(--api-blue-500-10)',
          '500/20': 'var(--api-blue-500-20)',
        },
        green: {
          400: 'var(--api-green-400)',
          500: 'var(--api-green-500)',
          '500/5': 'var(--api-green-500-5)',
          '500/10': 'var(--api-green-500-10)',
          '500/20': 'var(--api-green-500-20)',
        },
        purple: {
          400: 'var(--api-purple-400)',
          500: 'var(--api-purple-500)',
          '500/5': 'var(--api-purple-500-5)',
          '500/10': 'var(--api-purple-500-10)',
          '500/20': 'var(--api-purple-500-20)',
        },
        cyan: {
          400: 'var(--api-cyan-400)',
          500: 'var(--api-cyan-500)',
          '500/5': 'var(--api-cyan-500-5)',
          '500/10': 'var(--api-cyan-500-10)',
          '500/20': 'var(--api-cyan-500-20)',
        },
        amber: {
          400: 'var(--api-amber-400)',
          500: 'var(--api-amber-500)',
          '500/5': 'var(--api-amber-500-5)',
          '500/10': 'var(--api-amber-500-10)',
          '500/20': 'var(--api-amber-500-20)',
        },
        red: {
          400: 'var(--api-red-400)',
          500: 'var(--api-red-500)',
          '500/5': 'var(--api-red-500-5)',
          '500/10': 'var(--api-red-500-10)',
          '500/20': 'var(--api-red-500-20)',
        },
        pink: {
          400: 'var(--api-pink-400)',
          500: 'var(--api-pink-500)',
          '500/5': 'var(--api-pink-500-5)',
          '500/10': 'var(--api-pink-500-10)',
          '500/20': 'var(--api-pink-500-20)',
        },
        indigo: {
          400: 'var(--api-indigo-400)',
          500: 'var(--api-indigo-500)',
          '500/5': 'var(--api-indigo-500-5)',
          '500/10': 'var(--api-indigo-500-10)',
          '500/20': 'var(--api-indigo-500-20)',
        },
      },
      backdropBlur: {
        xl: "24px",
      },
    },
  },
  plugins: [],
}