// ============================================================================
// MOCK SAMPLE LIBRARY — WEB PREVIEW ONLY
// Device audio scanning (expo-media-library) is unavailable in a browser, so
// the web preview loads this sample library to exercise the full UX.
// On Android/iOS the app scans real device audio and this file is NOT used.
// ============================================================================
import { AudioFile } from '@/src/utils/audioMeta';

const SH = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;
const now = Date.now();
const d = (days: number, hours = 0) => now - days * 86400000 - hours * 3600000;
const MB = 1024 * 1024;

export const SAMPLE_AUDIO: AudioFile[] = [
  {
    id: 'sample-01', uri: SH(1), fileName: 'Lecture - Marketing 101.m4a',
    title: 'Lecture - Marketing 101', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Unknown Genre', duration: 1395, format: 'M4A', mimeType: 'audio/mp4',
    size: 24.2 * MB, source: 'Recordings', kind: 'recording', createdAt: d(0, 2), modifiedAt: d(0, 2),
  },
  {
    id: 'sample-02', uri: SH(2), fileName: 'Interview with Arjun.mp3',
    title: 'Interview with Arjun', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Unknown Genre', duration: 2712, format: 'MP3', mimeType: 'audio/mpeg',
    size: 38.1 * MB, source: 'Downloads', kind: 'recording', createdAt: d(0, 5), modifiedAt: d(0, 5),
  },
  {
    id: 'sample-03', uri: SH(3), fileName: 'Meeting Notes.wav',
    title: 'Meeting Notes', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Unknown Genre', duration: 2531, format: 'WAV', mimeType: 'audio/wav',
    size: 92.1 * MB, source: 'Recordings', kind: 'recording', createdAt: d(1), modifiedAt: d(1),
  },
  {
    id: 'sample-04', uri: SH(4), fileName: 'Voice Memo 12.m4a',
    title: 'Voice Memo 12', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Unknown Genre', duration: 201, format: 'M4A', mimeType: 'audio/mp4',
    size: 2.8 * MB, source: 'Voice Memos', kind: 'voice', createdAt: d(2), modifiedAt: d(2),
  },
  {
    id: 'sample-05', uri: SH(5), fileName: 'Client Call Recording.m4a',
    title: 'Client Call Recording', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Unknown Genre', duration: 313, format: 'M4A', mimeType: 'audio/mp4',
    size: 4.9 * MB, source: 'Recordings', kind: 'recording', createdAt: d(2, 6), modifiedAt: d(2, 6),
  },
  {
    id: 'sample-06', uri: SH(6), fileName: 'Podcast Episode 01.mp3',
    title: 'Podcast Episode 01', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Podcast', duration: 2298, format: 'MP3', mimeType: 'audio/mpeg',
    size: 52.6 * MB, source: 'Downloads', kind: 'other', createdAt: d(3), modifiedAt: d(3),
  },
  {
    id: 'sample-07', uri: SH(7), fileName: 'Kun Faya Kun.mp3',
    title: 'Kun Faya Kun', artist: 'A.R. Rahman', album: 'Rockstar',
    genre: 'Soundtrack', duration: 472, format: 'MP3', mimeType: 'audio/mpeg',
    size: 11.2 * MB, source: 'Music', kind: 'music', createdAt: d(5), modifiedAt: d(5),
  },
  {
    id: 'sample-08', uri: SH(8), fileName: 'Jiya Jale.mp3',
    title: 'Jiya Jale', artist: 'A.R. Rahman', album: 'Dil Se',
    genre: 'Soundtrack', duration: 393, format: 'MP3', mimeType: 'audio/mpeg',
    size: 9.4 * MB, source: 'Music', kind: 'music', createdAt: d(6), modifiedAt: d(6),
  },
  {
    id: 'sample-09', uri: SH(9), fileName: 'Vande Mataram.mp3',
    title: 'Vande Mataram', artist: 'A.R. Rahman', album: 'Vande Mataram',
    genre: 'World', duration: 402, format: 'MP3', mimeType: 'audio/mpeg',
    size: 9.8 * MB, source: 'Music', kind: 'music', createdAt: d(7), modifiedAt: d(7),
  },
  {
    id: 'sample-10', uri: SH(1), fileName: 'Midnight Drive.flac',
    title: 'Midnight Drive', artist: 'Nova Waves', album: 'Night Lines',
    genre: 'Electronic', duration: 252, format: 'FLAC', mimeType: 'audio/flac',
    size: 28.4 * MB, source: 'Music', kind: 'music', createdAt: d(9), modifiedAt: d(9),
  },
  {
    id: 'sample-11', uri: SH(2), fileName: 'WhatsApp Audio 2026-06-02.opus',
    title: 'WhatsApp Audio 2026-06-02', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Unknown Genre', duration: 72, format: 'OPUS', mimeType: 'audio/opus',
    size: 0.9 * MB, source: 'WhatsApp', kind: 'voice', createdAt: d(12), modifiedAt: d(12),
  },
  {
    id: 'sample-12', uri: SH(3), fileName: 'WhatsApp Audio 2026-05-28.opus',
    title: 'WhatsApp Audio 2026-05-28', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Unknown Genre', duration: 47, format: 'OPUS', mimeType: 'audio/opus',
    size: 0.6 * MB, source: 'WhatsApp', kind: 'voice', createdAt: d(17), modifiedAt: d(17),
  },
  {
    id: 'sample-13', uri: SH(4), fileName: 'Bluetooth_Track_Share.mp3',
    title: 'Bluetooth_Track_Share', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Unknown Genre', duration: 238, format: 'MP3', mimeType: 'audio/mpeg',
    size: 5.7 * MB, source: 'Bluetooth', kind: 'music', createdAt: d(21), modifiedAt: d(21),
  },
  {
    id: 'sample-14', uri: SH(5), fileName: 'Standup Recording June.aac',
    title: 'Standup Recording June', artist: 'Unknown Artist', album: 'Unknown Album',
    genre: 'Unknown Genre', duration: 724, format: 'AAC', mimeType: 'audio/aac',
    size: 11.9 * MB, source: 'Recordings', kind: 'recording', createdAt: d(25), modifiedAt: d(25),
  },
];
