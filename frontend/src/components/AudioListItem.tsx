import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLibrary } from '@/src/context/LibraryContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { AudioFile, AudioKind } from '@/src/utils/audioMeta';
import { formatDuration } from '@/src/utils/format';

const KIND_ICON: Record<AudioKind, keyof typeof Ionicons.glyphMap> = {
  music: 'musical-notes',
  recording: 'recording',
  voice: 'mic',
  other: 'volume-medium',
};

export function AudioListItem({ file }: { file: AudioFile }) {
  const router = useRouter();
  const { selection, selectionMode, toggleSelect, enterSelection, favorites } = useLibrary();
  const selected = selection.has(file.id);

  const onPress = () => {
    if (selectionMode) toggleSelect(file.id);
    else router.push(`/audio/${encodeURIComponent(file.id)}`);
  };

  return (
    <Pressable
      testID={`audio-item-${file.id}`}
      onPress={onPress}
      onLongPress={() => enterSelection(file.id)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
    >
      {selectionMode && (
        <View style={[styles.checkbox, selected && styles.checkboxOn]} testID={`audio-checkbox-${file.id}`}>
          {selected && <Ionicons name="checkmark" size={14} color={colors.white} />}
        </View>
      )}
      <View style={[styles.icon, selected && { backgroundColor: colors.brand }]}>
        <Ionicons name={KIND_ICON[file.kind]} size={20} color={selected ? colors.white : colors.onBrandTint} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{file.title}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {file.kind === 'music' ? file.artist : file.source}
          {'  ·  '}{file.format}{'  ·  '}{formatDuration(file.duration)}
        </Text>
      </View>
      {favorites.has(file.id) && (
        <Ionicons name="heart" size={14} color={colors.brand2} style={{ marginRight: spacing.sm }} />
      )}
      {!selectionMode && (
        <Ionicons name="chevron-forward" size={16} color={colors.onSurface2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg, gap: spacing.md, minHeight: 64,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5,
    borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  icon: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  title: { color: colors.onSurface, fontFamily: font.medium, fontSize: type.lg },
  sub: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm },
});
