// tunAide API service layer.
// Base URL comes from env — swap EXPO_PUBLIC_API_URL to point at the real
// tunAide Transcribe backend when it becomes available.
const BACKEND = process.env.EXPO_PUBLIC_API_URL;
export const API_URL = `${BACKEND}/api`;
export const TRANSCRIBE_WEB_URL = (process.env.EXPO_PUBLIC_TRANSCRIBE_WEB_URL || '').trim();

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('offline');
  }
  if (!res.ok) {
    let detail = 'Something went wrong. Please try again.';
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch { /* non-JSON error body */ }
    throw new Error(detail);
  }
  return res.json();
}

export interface ServerUpload {
  id: string; file_name: string; note: string; quality: string; priority: string;
  duration: number; size: number; status: string; is_duplicate: boolean;
  created_at: string; completed_at: string;
  queue_status?: string; phase_one_queue_id?: string; phase_one_published_at?: string; phase_one_error?: string;
}

export const activityApi = {
  uploads: () => apiFetch('/uploads') as Promise<ServerUpload[]>,
  retryPublish: (uploadId: string) => apiFetch(`/uploads/${uploadId}/retry_publish`, { method: 'POST' }),
};
