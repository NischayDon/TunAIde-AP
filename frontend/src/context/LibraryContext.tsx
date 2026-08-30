import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { SAMPLE_AUDIO } from '@/src/data/sampleAudio';
import {
  AudioFile, detectKind, detectSource, extOf, formatFromExt, mimeFor, SUPPORTED_EXTS,
} from '@/src/utils/audioMeta';
import { storage } from '@/src/utils/storage';

const LIB_KEY = 'tunaide.library.index';
const SCANNED_KEY = 'tunaide.library.scanned';
const FAV_KEY = 'tunaide.favorites';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'blocked' | 'web';

interface LibraryCtx {
  files: AudioFile[];
  libLoaded: boolean;
  hasScanned: boolean;
  scanning: boolean;
  scanPhase: string;
  foundCount: number;
  permission: PermissionState;
  favorites: Set<string>;
  selection: Set<string>;
  selectionMode: boolean;
  selectedFiles: AudioFile[];
  totalSelectedSize: number;
  requestPermissionAndScan: () => Promise<'granted' | 'denied' | 'blocked'>;
  rescan: () => Promise<void>;
  toggleFavorite: (id: string) => void;
  toggleSelect: (id: string) => void;
  enterSelection: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  getFile: (id: string) => AudioFile | undefined;
  markScanned: () => void;
}

const Ctx = createContext<LibraryCtx | null>(null);

export const useLibrary = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLibrary outside provider');
  return v;
};

function mapAsset(asset: MediaLibrary.Asset): AudioFile | null {
  try {
    const fileName = asset.filename || 'Unknown file';
    const ext = extOf(fileName);
    if (ext && !SUPPORTED_EXTS.includes(ext)) return null; // gracefully skip unsupported
    const source = detectSource(asset.uri || '', fileName);
    const duration = asset.duration || 0;
    const title = fileName.replace(/\.[^.]+$/, '');
    return {
      id: asset.id,
      uri: asset.uri,
      fileName,
      title,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      genre: 'Unknown Genre',
      duration,
      format: formatFromExt(ext),
      mimeType: mimeFor(ext),
      size: 0, // fetched lazily when needed
      source,
      kind: detectKind(fileName, source, duration),
      createdAt: (asset.creationTime || asset.modificationTime || Date.now()),
      modifiedAt: (asset.modificationTime || Date.now()),
    };
  } catch {
    return null; // never let one bad file break the scan
  }
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [libLoaded, setLibLoaded] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState('');
  const [foundCount, setFoundCount] = useState(0);
  const [permission, setPermission] = useState<PermissionState>(
    Platform.OS === 'web' ? 'web' : 'unknown',
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const filesRef = useRef<AudioFile[]>([]);
  filesRef.current = files;

  // Restore persisted index so the library works offline immediately.
  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(LIB_KEY, '');
        if (raw && typeof raw === 'string') {
          const parsed = JSON.parse(raw) as AudioFile[];
          if (Array.isArray(parsed)) setFiles(parsed);
        }
        const scanned = await storage.getItem<boolean>(SCANNED_KEY, false);
        setHasScanned(scanned === true);
        const favRaw = await storage.getItem(FAV_KEY, '');
        if (favRaw && typeof favRaw === 'string') {
          setFavorites(new Set(JSON.parse(favRaw) as string[]));
        }
      } catch { /* corrupted cache — start fresh */ } finally {
        setLibLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (list: AudioFile[]) => {
    await storage.setItem(LIB_KEY, JSON.stringify(list));
    await storage.setItem(SCANNED_KEY, true);
  }, []);

  const scanNative = useCallback(async () => {
    setScanning(true);
    setScanPhase('Finding audio files');
    setFoundCount(0);
    try {
      let after: MediaLibrary.AssetRef | undefined;
      let hasNext = true;
      let all: AudioFile[] = [];
      while (hasNext) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.audio,
          first: 200,
          after,
          sortBy: [MediaLibrary.SortBy.modificationTime],
        });
        const mapped = page.assets.map(mapAsset).filter(Boolean) as AudioFile[];
        all = [...all, ...mapped];
        setFiles([...all]);
        setFoundCount(all.length);
        setScanPhase(all.length > 400 ? 'Reading metadata' : 'Finding audio files');
        after = page.endCursor;
        hasNext = page.hasNextPage;
      }
      setScanPhase('Organizing your library');
      await persist(all);
      setHasScanned(true);
    } catch {
      setScanPhase('Scan failed');
    } finally {
      setScanning(false);
    }
  }, [persist]);

  const scanWeb = useCallback(async () => {
    // MOCK: web preview cannot access device storage — load the sample library.
    setScanning(true);
    setFoundCount(0);
    const phases = ['Finding audio files', 'Reading metadata', 'Organizing your library'];
    for (let i = 0; i < phases.length; i++) {
      setScanPhase(phases[i]);
      // incremental reveal for a realistic scan feel
      const slice = SAMPLE_AUDIO.slice(0, Math.ceil(((i + 1) / phases.length) * SAMPLE_AUDIO.length));
      setFiles(slice);
      setFoundCount(slice.length);
      await new Promise((r) => setTimeout(r, 550));
    }
    await persist(SAMPLE_AUDIO);
    setHasScanned(true);
    setScanning(false);
  }, [persist]);

  const requestPermissionAndScan = useCallback(async (): Promise<'granted' | 'denied' | 'blocked'> => {
    if (Platform.OS === 'web') {
      setPermission('web');
      await scanWeb();
      return 'granted';
    }
    const existing = await MediaLibrary.getPermissionsAsync();
    let perm = existing;
    if (!existing.granted && existing.canAskAgain) {
      perm = await MediaLibrary.requestPermissionsAsync();
    }
    if (perm.granted || perm.accessPrivileges === 'limited') {
      setPermission('granted');
      await scanNative();
      return 'granted';
    }
    const blocked = !perm.canAskAgain;
    setPermission(blocked ? 'blocked' : 'denied');
    return blocked ? 'blocked' : 'denied';
  }, [scanNative, scanWeb]);

  const rescan = useCallback(async () => {
    if (Platform.OS === 'web') { await scanWeb(); return; }
    const perm = await MediaLibrary.getPermissionsAsync();
    if (perm.granted || perm.accessPrivileges === 'limited') {
      await scanNative();
    } else {
      await requestPermissionAndScan();
    }
  }, [requestPermissionAndScan, scanNative, scanWeb]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      storage.setItem(FAV_KEY, JSON.stringify([...next]));
      return next;
    });
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  }, []);

  const enterSelection = useCallback((id: string) => {
    setSelection((prev) => new Set(prev).add(id));
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  }, []);

  const selectMany = useCallback((ids: string[]) => {
    setSelection((prev) => {
      const next = new Set(prev);
      ids.forEach((i) => next.add(i));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelection(new Set()), []);

  const getFile = useCallback((id: string) => filesRef.current.find((f) => f.id === id), []);

  const markScanned = useCallback(() => {
    setHasScanned(true);
    storage.setItem(SCANNED_KEY, true);
  }, []);

  const selectedFiles = useMemo(
    () => files.filter((f) => selection.has(f.id)), [files, selection]);
  const totalSelectedSize = useMemo(
    () => selectedFiles.reduce((s, f) => s + (f.size || 0), 0), [selectedFiles]);

  const value: LibraryCtx = {
    files, libLoaded, hasScanned, scanning, scanPhase, foundCount, permission,
    favorites, selection, selectionMode: selection.size > 0, selectedFiles,
    totalSelectedSize, requestPermissionAndScan, rescan, toggleFavorite,
    toggleSelect, enterSelection, selectMany, clearSelection, getFile, markScanned,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
