/** Backend API origin for future sync (no network calls in this demo). */
const raw = import.meta.env.VITE_API_BASE_URL;
export const apiBaseUrl = typeof raw === 'string' ? raw.replace(/\/$/, '') : '';
