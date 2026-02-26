import type { MirrorHistoryApi } from '../../shared/types';
import { httpApi } from './httpApi';
import { mockApi } from './mockApi';

declare global {
  interface Window {
    api: MirrorHistoryApi;
  }
}

// Detect Vite dev server (port 5173 without Electron)
const isDevPreview = !window.api && typeof window !== 'undefined' && window.location?.port === '5173';

export function useApi(): MirrorHistoryApi {
  // In Electron, window.api is provided by the preload script via IPC.
  if (window.api) return window.api;
  // In dev preview (Vite without backend), fall back to mock API.
  if (isDevPreview) return mockApi;
  // In web standalone/Docker mode, use HTTP API client.
  return httpApi;
}
