import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, MetaRow, PrimaryButton } from '@/src/components/common';
import { useLibrary } from '@/src/context/LibraryContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { AudioFile } from '@/src/utils/audioMeta';
import { formatBytes, formatDate, formatDuration } from '@/src/utils/format';

function PreviewPlayer({ file }: { file: AudioFile }) {
  const player = useAudioPlayer({ uri: file.uri });
  const status = useAudioPlayerStatus(player);
  const trackWidth = React.useRef(0);
  const duration = status.duration || file.duration || 0;
  const position = status.currentTime || 0;
  const progress = duration > 0 ? position / duration : 0;

  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (duration > 0 && position >= duration - 0.3) player.seekTo(0);
      player.play();
    }
  };

  const skip = (delta: number) => {
    player.seekTo(Math.max(0, Math.min(duration, position + delta)));
  };

  return (
    <View style={pStyles.card} testID="audio-preview-player">
      <View style={pStyles.controls}>
        <Pressable testID="player-back-10" onPress={() => skip(-10)} hitSlop={8} style={pStyles.skipBtn}>
          <Ionicons name="play-back" size={18} color={colors.onSurface3} />
          <Text style={pStyles.skipText}>10</Text>
        </Pressable>
        <Pressable testID="player-play-pause-button" onPress={toggle} style={pStyles.playBtn}>
          <Ionicons name={status.playing ? 'pause' : 'play'} size={26} color={colors.white} style={{ marginLeft: status.playing ? 0 : 2 }} />
        </Pressable>
        <Pressable testID="player-forward-10" onPress={() => skip(10)} hitSlop={8} style={pStyles.skipBtn}>
          <Ionicons name="play-forward" size={18} color={colors.onSurface3} />
          <Text style={pStyles.skipText}>10</Text>
        </Pressable>
      </View>
      <Pressable
        testID="player-seek-bar"
        style={pStyles.trackHit}
        onPress={(e) => {
          const { locationX } = e.nativeEvent;
          if (trackWidth.current > 0 && duration > 0) {
            player.seekTo((locationX / trackWidth.current) * duration);
          }
        }}
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
      >
        <View style={pStyles.track}>
          <View style={[pStyles.fill, { width: `${Math.min(100, progress * 100)}%` }]} />
          <View style={[pStyles.knob, { left: `${Math.min(98, progress * 100)}%` }]} />
        </View>
      </Pressable>
      <View style={pStyles.times}>
        <Text style={pStyles.time}>{formatDuration(position)}</Text>
        <Text style={pStyles.time}>{formatDuration(duration)}</Text>
      </View>
    </View>
  );
}

export default function AudioDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getFile, favorites, toggleFavorite, selection, toggleSelect, enterSelection } = useLibrary();

  const file = useMemo(() => getFile(decodeURIComponent(id || '')), [id, getFile]);

  if (!file) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <EmptyState
          testID="audio-not-found"
          icon="alert-circle"
          title="File not found"
          body="This audio file is no longer in your library. It may have been moved or deleted."
          actionLabel="Back to Library"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const isFav = favorites.has(file.id);
  const isSelected = selection.has(file.id);

  const pushNow = () => {
    if (!isSelected) enterSelection(file.id);
    router.push('/push-config');
  };

  return (
    <View style={styles.container} testID="audio-detail-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="audio-detail-back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.onSurface3} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Audio Detail</Text>
        <Pressable
          testID="audio-favorite-button"
          onPress={() => toggleFavorite(file.id)}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? colors.brand2 : colors.onSurface3} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 240 }} showsVerticalScrollIndicator={false}>
        <View style={styles.artWrap}>
          <View style={styles.artGlow} />
          <View style={styles.artTile}>
            <Ionicons
              name={file.kind === 'music' ? 'musical-notes' : file.kind === 'voice' ? 'mic' : 'recording'}
              size={54}
              color={colors.onBrandTint}
            />
          </View>
        </View>
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Text style={styles.title} testID="audio-detail-title">{file.title}</Text>
          <Text style={styles.subtitle}>
            {file.artist} · {file.album}
          </Text>

          <PrimaryButton
            testID="audio-detail-push-button"
            label="Push to tunAide Transcribe"
            icon="cloud-upload"
            onPress={pushNow}
            style={{ marginTop: spacing.xl }}
          />
          <Pressable
            testID="audio-detail-select-button"
            onPress={() => (isSelected ? toggleSelect(file.id) : enterSelection(file.id))}
            style={[styles.selectBtn, isSelected && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}
          >
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
              size={18}
              color={isSelected ? colors.onBrandTint : colors.onSurface3}
            />
            <Text style={[styles.selectText, isSelected && { color: colors.onBrandTint }]}>
              {isSelected ? 'In selection' : 'Add to selection'}
            </Text>
          </Pressable>

          <View style={styles.metaCard}>
            <MetaRow label="File name" value={file.fileName} />
            <MetaRow label="Format" value={file.format} />
            <MetaRow label="Size" value={formatBytes(file.size)} />
            <MetaRow label="Duration" value={formatDuration(file.duration)} />
            <MetaRow label="Source" value={file.source} />
            <MetaRow label="Type" value={file.kind === 'voice' ? 'Voice memo' : file.kind.charAt(0).toUpperCase() + file.kind.slice(1)} />
            <MetaRow label="Genre" value={file.genre} />
            <MetaRow label="Date added" value={formatDate(file.createdAt)} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.playerHolder, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PreviewPlayer file={file} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { flex: 1, color: colors.onSurface, fontFamily: font.semibold, fontSize: type.lg, textAlign: 'center' },
  artWrap: { alignItems: 'center', marginTop: spacing.xl },
  artGlow: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: colors.brandTint, opacity: 0.45, top: -20,
  },
  artTile: {
    width: 140, height: 140, borderRadius: radius.lg, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.brand,
  },
  title: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xxl, marginTop: spacing.xl, textAlign: 'center' },
  subtitle: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.base, marginTop: spacing.xs, textAlign: 'center' },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 13, marginTop: spacing.md, minHeight: 48,
  },
  selectText: { color: colors.onSurface3, fontFamily: font.medium, fontSize: type.base },
  metaCard: {
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, marginTop: spacing.xl,
  },
  playerHolder: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
});

const pStyles = StyleSheet.create({
  card: { gap: spacing.sm },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxl },
  skipBtn: { alignItems: 'center', minWidth: 44, minHeight: 44, justifyContent: 'center' },
  skipText: { color: colors.onSurface2, fontFamily: font.medium, fontSize: 10 },
  playBtn: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  trackHit: { paddingVertical: spacing.sm, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surface3, overflow: 'visible' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  knob: {
    position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.brand2, marginLeft: -6,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm },
});
