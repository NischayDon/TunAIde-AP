import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioListItem } from '@/src/components/AudioListItem';
import { EmptyState, SectionTitle } from '@/src/components/common';
import { SelectionBar } from '@/src/components/SelectionBar';
import { useLibrary } from '@/src/context/LibraryContext';
import { colors, font, radius, spacing, type } from '@/src/theme';

const CATEGORIES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; filter: string }[] = [
  { key: 'all', label: 'All Audio', icon: 'albums', filter: 'all' },
  { key: 'music', label: 'Music', icon: 'musical-notes', filter: 'music' },
  { key: 'recordings', label: 'Recordings', icon: 'recording', filter: 'recordings' },
  { key: 'voice', label: 'Voice Memos', icon: 'mic', filter: 'voice' },
  { key: 'downloads', label: 'Downloads', icon: 'download', filter: 'downloads' },
  { key: 'favorites', label: 'Favorites', icon: 'heart', filter: 'favorites' },
];

const BROWSE: { key: string; label: string }[] = [
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
  { key: 'genres', label: 'Genres' },
  { key: 'formats', label: 'Formats' },
  { key: 'sources', label: 'Sources' },
  { key: 'durations', label: 'Duration' },
];

export default function LibraryHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { files, favorites, rescan, scanning } = useLibrary();
  const [refreshing, setRefreshing] = useState(false);

  const counts = useMemo(() => ({
    all: files.length,
    music: files.filter((f) => f.kind === 'music').length,
    recordings: files.filter((f) => f.kind === 'recording' || f.kind === 'voice').length,
    voice: files.filter((f) => f.kind === 'voice').length,
    downloads: files.filter((f) => f.source === 'Downloads').length,
    favorites: files.filter((f) => favorites.has(f.id)).length,
  }), [files, favorites]);

  const recent = useMemo(
    () => [...files].sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 12),
    [files],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await rescan();
    setRefreshing(false);
  };

  const header = (
    <View>
      <Pressable
        testID="library-search-bar"
        style={styles.searchBar}
        onPress={() => router.push('/(tabs)/search')}
      >
        <Ionicons name="search" size={18} color={colors.onSurface2} />
        <Text style={styles.searchPlaceholder}>Search audio, artist, album...</Text>
      </Pressable>

      <View style={styles.grid}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            testID={`category-card-${c.key}`}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(`/category/${c.filter}`)}
          >
            <View style={styles.cardIcon}>
              <Ionicons name={c.icon} size={20} color={colors.onBrandTint} />
            </View>
            <Text style={styles.cardLabel}>{c.label}</Text>
            <Text style={styles.cardCount}>{counts[c.key as keyof typeof counts]} files</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {BROWSE.map((b) => (
            <Pressable
              key={b.key}
              testID={`browse-chip-${b.key}`}
              style={styles.browseChip}
              onPress={() => router.push(`/category/${b.key}`)}
            >
              <Text style={styles.browseChipText}>{b.label}</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.onSurface2} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {recent.length > 0 && (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <SectionTitle
            title="Recently Added"
            action="See All"
            onAction={() => router.push('/category/recent')}
          />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container} testID="library-home-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={styles.brand}>
            tunAide <Text style={{ color: colors.brand2 }}>AP</Text>
          </Text>
          <Text style={styles.subtitle}>Your Audio Library</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            testID="library-rescan-button"
            onPress={onRefresh}
            style={styles.headerBtn}
            hitSlop={6}
          >
            <Ionicons name="refresh" size={20} color={scanning ? colors.brand2 : colors.onSurface3} />
          </Pressable>
          <Pressable
            testID="library-settings-button"
            onPress={() => router.push('/settings')}
            style={styles.headerBtn}
            hitSlop={6}
          >
            <Ionicons name="settings-outline" size={20} color={colors.onSurface3} />
          </Pressable>
        </View>
      </View>

      {files.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            testID="library-empty-state"
            icon="folder-open"
            title="No audio found"
            body="We couldn't find any accessible audio files on this device."
            actionLabel="Scan Again"
            onAction={onRefresh}
          />
        </View>
      ) : (
        <FlatList
          data={recent}
          keyExtractor={(f) => f.id}
          renderItem={({ item }) => <AudioListItem file={item} />}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand2} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      <SelectionBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  brand: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xxl },
  subtitle: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.lg, marginTop: spacing.lg, paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  searchPlaceholder: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.base },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
    paddingHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  card: {
    width: '47.8%', backgroundColor: colors.surface2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.xs,
  },
  cardIcon: {
    width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  cardLabel: { color: colors.onSurface, fontFamily: font.semibold, fontSize: type.base },
  cardCount: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm },
  chipRowWrap: { height: 56, marginTop: spacing.md },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' },
  browseChip: {
    height: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, borderRadius: radius.pill, flexShrink: 0,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
  },
  browseChipText: { color: colors.onSurface3, fontFamily: font.medium, fontSize: type.base },
});
