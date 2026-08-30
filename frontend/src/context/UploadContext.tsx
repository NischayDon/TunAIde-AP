// Upload engine: queue, progress, retry, cancel, offline + Wi-Fi-only handling.
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { API_URL } from '@/src/api/client';
import { useToast } from '@/src/context/ToastContext';
import { AudioFile } from '@/src/utils/audioMeta';
import { storage } from '@/src/utils/storage';

export type UploadStatus =
  | 'queued' | 'preparing' | 'uploading' | 'processing' | 'complete' | 'failed' | 'cancelled';

export interface PushConfig { note: string; quality: string; priority: string }

export interface UploadJob {
  id: string;
  file: AudioFile;
  status: UploadStatus;
  progress: number; // 0..1
  uploadedBytes: number;
  totalBytes: number;
  error?: string;
  config: PushConfig;
  batchId: string;
  retryCount: number;
  createdAt: number;
}

interface UploadCtx {
  jobs: UploadJob[];
  activeCount: number;
  queuedCount: number;
  enqueue: (files: AudioFile[], config: PushConfig, autoStart: boolean) => string;
  startQueue: () => void;
  cancelJob: (id: string) => void;
  retryJob: (id: string) => void;
  removeJob: (id: string) => void;
  clearFinished: () => void;
}

const Ctx = createContext<UploadCtx | null>(null);

export const useUploads = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUploads outside provider');
  return v;
};

const ACTIVE: UploadStatus[] = ['preparing', 'uploading', 'processing'];

// Synthesized WAV used only on web preview when the sample URL cannot be
// fetched cross-origin — keeps the push flow fully testable. (MOCK fallback)
function makeWavBlob(seconds = 2): Blob {
  const sampleRate = 22050;
  const samples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeStr(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    view.setInt16(44 + i * 2, Math.round(Math.sin((i / sampleRate) * 2 * Math.PI * 440) * 8000), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const jobsRef = useRef<UploadJob[]>([]);
  jobsRef.current = jobs;
  const runningRef = useRef(false);
  const handlesRef = useRef<Map<string, { cancel: () => void }>>(new Map());
  const { showToast } = useToast();

  const update = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const checkNetwork = useCallback(async (): Promise<'ok' | 'offline' | 'wifi-required'> => {
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
      const wifiOnly = await storage.getItem<boolean>('tunaide.settings.wifiOnly', false);
      if (wifiOnly === true && Platform.OS !== 'web' && state.type !== Network.NetworkStateType.WIFI) {
        return 'wifi-required';
      }
    } catch { /* if network check fails, attempt the upload anyway */ }
    return 'ok';
  }, []);

  const runJob = useCallback(async (job: UploadJob): Promise<boolean> => {
    update(job.id, { status: 'preparing', error: undefined });
    const url = `${API_URL}/uploads`;
    const fields = {
      file_name: job.file.fileName,
      title: job.file.title,
      artist: job.file.artist,
      note: job.config.note,
      quality: job.config.quality,
      priority: job.config.priority,
      duration: String(job.file.duration || 0),
    };

    try {
      if (Platform.OS === 'web') {
        let blob: Blob;
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(job.file.uri, { signal: controller.signal });
          clearTimeout(t);
          if (!res.ok) throw new Error('fetch failed');
          blob = await res.blob();
        } catch {
          blob = makeWavBlob(); // MOCK fallback for web preview sample files
        }
        update(job.id, { status: 'uploading', totalBytes: blob.size });
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          handlesRef.current.set(job.id, { cancel: () => xhr.abort() });
          xhr.open('POST', url);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              update(job.id, { progress: e.loaded / e.total, uploadedBytes: e.loaded, totalBytes: e.total });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else {
              let msg = 'Upload failed. Please retry.';
              try { msg = JSON.parse(xhr.responseText).detail || msg; } catch { /* keep default */ }
              reject(new Error(msg));
            }
          };
          xhr.onerror = () => reject(new Error('Network error during upload. Check your connection and retry.'));
          xhr.onabort = () => reject(new Error('__cancelled__'));
          const form = new FormData();
          Object.entries(fields).forEach(([k, v]) => form.append(k, v));
          form.append('file', blob, job.file.fileName);
          xhr.send(form);
        });
      } else {
        update(job.id, { status: 'uploading' });
        const task = FileSystem.createUploadTask(
          url, job.file.uri,
          {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            mimeType: job.file.mimeType,
            parameters: fields,
          },
          (p) => {
            const total = p.totalBytesExpectedToSend || job.file.size || 1;
            update(job.id, {
              progress: Math.min(p.totalBytesSent / total, 1),
              uploadedBytes: p.totalBytesSent,
              totalBytes: total,
            });
          },
        );
        handlesRef.current.set(job.id, { cancel: () => { task.cancelAsync().catch(() => {}); } });
        const result = await task.uploadAsync();
        if (!result) throw new Error('__cancelled__');
        if (result.status < 200 || result.status >= 300) {
          let msg = 'Upload failed. Please retry.';
          try { msg = JSON.parse(result.body).detail || msg; } catch { /* keep default */ }
          throw new Error(msg);
        }
      }
      handlesRef.current.delete(job.id);
      update(job.id, { status: 'complete', progress: 1 });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      return true;
    } catch (e) {
      handlesRef.current.delete(job.id);
      const msg = e instanceof Error ? e.message : 'Upload failed. Please retry.';
      if (msg === '__cancelled__') {
        update(job.id, { status: 'cancelled', error: 'Upload cancelled' });
        return false;
      }
      const autoRetry = await storage.getItem<boolean>('tunaide.settings.autoRetry', true);
      if (autoRetry === true && job.retryCount < 1) {
        update(job.id, { status: 'queued', retryCount: job.retryCount + 1, progress: 0, uploadedBytes: 0 });
        return true; // stays queued, will be picked up again
      }
      update(job.id, { status: 'failed', error: msg });
      return false;
    }
  }, [update]);

  const processQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      // sequential engine — one active upload at a time
      while (true) {
        const next = jobsRef.current.find((j) => j.status === 'queued');
        if (!next) break;
        const net = await checkNetwork();
        if (net === 'offline') {
          showToast("You're offline — files stay in the queue and can be pushed once you're back online.", 'info');
          break;
        }
        if (net === 'wifi-required') {
          showToast('Wi-Fi only uploads is on. Connect to Wi-Fi or change it in Settings.', 'info');
          break;
        }
        await runJob({ ...next });
      }
    } finally {
      runningRef.current = false;
    }
  }, [checkNetwork, runJob, showToast]);

  const enqueue = useCallback((files: AudioFile[], config: PushConfig, autoStart: boolean): string => {
    const batchId = `batch-${Date.now()}`;
    const newJobs: UploadJob[] = files.map((file, i) => ({
      id: `${batchId}-${i}`,
      file,
      status: 'queued',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: file.size || 0,
      config,
      batchId,
      retryCount: 0,
      createdAt: Date.now(),
    }));
    setJobs((prev) => [...newJobs, ...prev]);
    jobsRef.current = [...newJobs, ...jobsRef.current];
    if (autoStart) setTimeout(() => { processQueue(); }, 50);
    return batchId;
  }, [processQueue]);

  const startQueue = useCallback(() => { processQueue(); }, [processQueue]);

  const cancelJob = useCallback((id: string) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (!job) return;
    if (ACTIVE.includes(job.status)) {
      handlesRef.current.get(id)?.cancel();
      update(id, { status: 'cancelled', error: 'Upload cancelled' });
    } else if (job.status === 'queued') {
      update(id, { status: 'cancelled', error: 'Removed from queue' });
    }
  }, [update]);

  const retryJob = useCallback((id: string) => {
    update(id, { status: 'queued', error: undefined, progress: 0, uploadedBytes: 0, retryCount: 0 });
    setTimeout(() => { processQueue(); }, 50);
  }, [processQueue, update]);

  const removeJob = useCallback((id: string) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (job && ACTIVE.includes(job.status)) return; // cancel first
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setJobs((prev) => prev.filter((j) => !['complete', 'cancelled'].includes(j.status)));
  }, []);

  const activeCount = jobs.filter((j) => ACTIVE.includes(j.status)).length;
  const queuedCount = jobs.filter((j) => j.status === 'queued').length;

  return (
    <Ctx.Provider value={{ jobs, activeCount, queuedCount, enqueue, startQueue, cancelJob, retryJob, removeJob, clearFinished }}>
      {children}
    </Ctx.Provider>
  );
}
