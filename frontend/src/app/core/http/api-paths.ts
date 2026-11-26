export const API_PREFIX = '/api';

export function isApiUrl(url: string): boolean {
  return url === API_PREFIX || url.startsWith(`${API_PREFIX}/`);
}

export function apiUrl(path: string): string {
  return `${API_PREFIX}/${path.replace(/^\/+/, '')}`;
}
