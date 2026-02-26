/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark content surfaces (warm dark grays)
        surface: {
          0: '#0f0f17',
          1: '#161622',
          2: '#1e1e2e',
          3: '#2a2a3c',
        },
        // Dark sidebar
        sidebar: {
          bg: '#0a0a12',
          hover: '#14141f',
          active: '#1a1a2e',
          border: '#1f1f30',
        },
        // Sci-fi accent system
        grain: {
          cyan: '#06b6d4',
          'cyan-dim': '#0e7490',
          'cyan-glow': '#22d3ee',
          amber: '#f59e0b',
          purple: '#a855f7',
          rose: '#f43f5e',
          emerald: '#10b981',
          indigo: '#6366f1',
        },
        // Text on dark backgrounds (high contrast for readability)
        text: {
          primary: '#eeeef5',
          secondary: '#b0b0c8',
          muted: '#8888a4',
          inverse: '#0f0f17',
        },
        // Legacy accent aliases (keep for existing card-type usage)
        accent: {
          green: '#10b981',
          red: '#f43f5e',
          yellow: '#f59e0b',
          blue: '#06b6d4',
        },
      },
      fontFamily: {
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'grain-load': 'grainLoad 1.2s ease-out',
        'memory-fade': 'memoryFade 0.4s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'counter-tick': 'counterTick 0.3s ease-out',
        'slide-up': 'slideUp 0.15s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'typewriter-cursor': 'blink 0.8s step-end infinite',
      },
      keyframes: {
        grainLoad: {
          '0%': { opacity: '0', transform: 'scale(0.97)', filter: 'blur(4px)' },
          '50%': { opacity: '0.7', filter: 'blur(1px)' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'blur(0)' },
        },
        memoryFade: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(6, 182, 212, 0.3)' },
          '50%': { boxShadow: '0 0 15px rgba(6, 182, 212, 0.6)' },
        },
        counterTick: {
          '0%': { transform: 'scale(1.1)', opacity: '0.7' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        wave: {
          from: { height: '4px' },
          to: { height: '20px' },
        },
      },
      boxShadow: {
        grain: '0 0 20px rgba(6, 182, 212, 0.1)',
        'grain-lg': '0 0 40px rgba(6, 182, 212, 0.15)',
        card: '0 2px 8px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
