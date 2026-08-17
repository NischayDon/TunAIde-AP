// Virtual library model + categorization helpers.
// Original files are never moved or renamed — this is an in-app index only.

export type AudioKind = 'music' | 'recording' | 'voice' | 'other';

export interface AudioFile {
  id: string;
  uri: string;
  fileName: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number; // seconds
  format: string; // MP3, WAV...
  mimeType: string;
  size: number; // bytes, 0 = unknown (fetched lazily on native)
  source: string; // e.g. Downloads, WhatsApp, Recordings
  kind: AudioKind;
  createdAt: number; // ms epoch
  modifiedAt: number; // ms epoch
}

export const SUPPORTED_EXTS = [
  'mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'aiff', 'aif', 'wma', 'amr', 'mid', 'midi',
];

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4',
  aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/opus', aiff: 'audio/aiff',
  aif: 'audio/aiff', wma: 'audio/x-ms-wma', amr: 'audio/amr', mid: 'audio/midi',
  midi: 'audio/midi',
};

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function formatFromExt(ext: string): string {
  if (!ext) return 'AUDIO';
  if (ext === 'aif') return 'AIFF';
  if (ext === 'mid') return 'MIDI';
  return ext.toUpperCase();
}

export function mimeFor(ext: string): string {
  return MIME[ext] || 'audio/mpeg';
}

export function detectSource(uri: string, fileName: string): string {
  const s = `${uri}/${fileName}`.toLowerCase();
  if (s.includes('whatsapp')) return 'WhatsApp';
  if (s.includes('telegram')) return 'Telegram';
  if (s.includes('bluetooth')) return 'Bluetooth';
  if (s.includes('download')) return 'Downloads';
  if (s.includes('voice') || s.includes('memo') || s.includes('ptt')) return 'Voice Memos';
  if (s.includes('record') || s.includes('call')) return 'Recordings';
  if (s.includes('ringtone') || s.includes('notification')) return 'Ringtones';
  if (s.includes('music')) return 'Music';
  if (s.includes('podcast')) return 'Podcasts';
  return 'Device Storage';
}

export function detectKind(fileName: string, source: string, duration: number): AudioKind {
  const n = fileName.toLowerCase();
  if (source === 'Voice Memos' || /(^|[^a-z])(voice|memo|ptt)([^a-z]|$)/.test(n)) return 'voice';
  if (source === 'WhatsApp' || source === 'Telegram') return duration <= 300 ? 'voice' : 'recording';
  if (source === 'Recordings' || /(rec(ording)?|meeting|interview|lecture|standup|call|aud-)/.test(n)) {
    return 'recording';
  }
  if (source === 'Music' || duration > 90) return 'music';
  return 'other';
}

export function durationBucket(sec: number): string {
  if (sec < 120) return 'Under 2 min';
  if (sec < 300) return '2–5 min';
  if (sec < 900) return '5–15 min';
  return 'Over 15 min';
}

const DURATION_BUCKETS = ['Under 2 min', '2–5 min', '5–15 min', 'Over 15 min'];

export type SortKey = 'name' | 'dateAdded' | 'duration' | 'size' | 'artist' | 'format';

export function sortFiles(files: AudioFile[], key: SortKey): AudioFile[] {
  const arr = [...files];
  switch (key) {
    case 'name': return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'artist': return arr.sort((a, b) => a.artist.localeCompare(b.artist));
    case 'duration': return arr.sort((a, b) => b.duration - a.duration);
    case 'size': return arr.sort((a, b) => b.size - a.size);
    case 'format': return arr.sort((a, b) => a.format.localeCompare(b.format));
    default: return arr.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
}

export function searchFiles(files: AudioFile[], q: string): AudioFile[] {
  const query = q.trim().toLowerCase();
  if (!query) return files;
  return files.filter((f) =>
    f.fileName.toLowerCase().includes(query) ||
    f.title.toLowerCase().includes(query) ||
    f.artist.toLowerCase().includes(query) ||
    f.album.toLowerCase().includes(query) ||
    f.genre.toLowerCase().includes(query) ||
    f.source.toLowerCase().includes(query) ||
    f.format.toLowerCase().includes(query),
  );
}

export interface CategoryResult {
  title: string;
  mode: 'files' | 'groups';
  files: AudioFile[];
  groups: { label: string; count: number; key: string }[];
}

function groupBy(files: AudioFile[], getter: (f: AudioFile) => string, prefix: string) {
  const map = new Map<string, number>();
  files.forEach((f) => {
    const g = getter(f) || 'Unknown';
    map.set(g, (map.get(g) || 0) + 1);
  });
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, key: `${prefix}:${label}` }));
}

export function resolveCategory(
  key: string, files: AudioFile[], favorites: Set<string>,
): CategoryResult {
  const empty = { files: [] as AudioFile[], groups: [] as CategoryResult['groups'] };
  const recent = [...files].sort((a, b) => b.modifiedAt - a.modifiedAt);

  switch (key) {
    case 'all': return { title: 'All Audio', mode: 'files', ...empty, files: recent };
    case 'music': return { title: 'Music', mode: 'files', ...empty, files: recent.filter((f) => f.kind === 'music') };
    case 'recordings': return { title: 'Recordings', mode: 'files', ...empty, files: recent.filter((f) => f.kind === 'recording' || f.kind === 'voice') };
    case 'voice': return { title: 'Voice Memos', mode: 'files', ...empty, files: recent.filter((f) => f.kind === 'voice') };
    case 'downloads': return { title: 'Downloads', mode: 'files', ...empty, files: recent.filter((f) => f.source === 'Downloads') };
    case 'recent': return { title: 'Recently Added', mode: 'files', ...empty, files: recent.slice(0, 50) };
    case 'favorites': return { title: 'Favorites', mode: 'files', ...empty, files: recent.filter((f) => favorites.has(f.id)) };
    case 'artists': return { title: 'Artists', mode: 'groups', ...empty, groups: groupBy(files, (f) => f.artist, 'artist') };
    case 'albums': return { title: 'Albums', mode: 'groups', ...empty, groups: groupBy(files, (f) => f.album, 'album') };
    case 'genres': return { title: 'Genres', mode: 'groups', ...empty, groups: groupBy(files, (f) => f.genre, 'genre') };
    case 'formats': return { title: 'Formats', mode: 'groups', ...empty, groups: groupBy(files, (f) => f.format, 'format') };
    case 'sources': return { title: 'Sources', mode: 'groups', ...empty, groups: groupBy(files, (f) => f.source, 'source') };
    case 'durations': return {
      title: 'Duration', mode: 'groups', ...empty,
      groups: DURATION_BUCKETS
        .map((label) => ({ label, count: files.filter((f) => durationBucket(f.duration) === label).length, key: `duration:${label}` }))
        .filter((g) => g.count > 0),
    };
    default: break;
  }

  const idx = key.indexOf(':');
  if (idx > 0) {
    const dim = key.slice(0, idx);
    const val = key.slice(idx + 1);
    const by: Record<string, (f: AudioFile) => string> = {
      artist: (f) => f.artist, album: (f) => f.album, genre: (f) => f.genre,
      format: (f) => f.format, source: (f) => f.source,
      duration: (f) => durationBucket(f.duration),
    };
    const getter = by[dim];
    if (getter) {
      return { title: val, mode: 'files', ...empty, files: recent.filter((f) => (getter(f) || 'Unknown') === val) };
    }
  }
  return { title: 'All Audio', mode: 'files', ...empty, files: recent };
}
