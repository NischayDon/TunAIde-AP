import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioListItem } from '@/src/components/AudioListItem';
import { Chip, EmptyState } from '@/src/components/common';
import { SelectionBar } from '@/src/components/SelectionBar';
import { Sheet, SheetOption } from '@/src/components/Sheet';
import { useLibrary } from '@/src/context/LibraryContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { durationBucket, searchFiles, SortKey, sortFiles } from '@/src/utils/audioMeta';

const KIND_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'music', label: 'Music' },
  { key: 'recording', label: 'Recordings' },
  { key: 'voice', label: 'Voice' },
];

const DURATION_CHIPS = ['Under 2 min', '2–5 min', '5–15 min', 'Over 15 min'];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'dateAdded', label: 'Date added' },
  { key: 'name', label: 'Name' },
  { key: 'duration', label: 'Duration' },
  { key: 'size', label: 'File size' },
  { key: 'artist', label: 'Artist' },
  { key: 'format', label: 'Format' },
];

export default function Search() {
  const insets = useSafeAreaInsets();
  const { files } = useLibrary();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [format, setFormat] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('dateAdded');
  const [sheetOpen, setSheetOpen] = useState(false);

  const formats = useMemo(
    () => [...new Set(files.map((f) => f.format))].sort(), [files]);

  const results = useMemo(() => {
    let list = searchFiles(files, query);
    if (kind !== 'all') {
      list = list.filter((f) => (kind === 'recording' ? f.kind === 'recording' || f.kind === 'voice' : f.kind === kind));
    }
    if (format) list = list.filter((f) => f.format === format);
    if (duration) list = list.filter((f) => durationBucket(f.duration) === duration);
    return sortFiles(list, sort);
  }, [files, query, kind, format, duration, sort]);

  const filtersActive = kind !== 'all' || !!format || !!duration;

  return (
    <View style={styles.container} testID="search-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Search</Text>
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <Ionicons name="search" size={18} color={colors.onSurface2} />
            <TextInput
              testID="search-input"
              style={styles.input}
              placeholder="Search audio, artist, album..."
              placeholderTextColor={colors.onSurface2}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8} testID="search-clear-button">
                <Ionicons name="close-circle" size={18} color={colors.onSurface2} />
              </Pressable>
            )}
          </View>
          <Pressable
            testID="search-filter-button"
            style={[styles.filterBtn, filtersActive && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}
            onPress={() => setSheetOpen(true)}
          >
            <Ionicons name="options" size={20} color={filtersActive ? colors.onBrandTint : colors.onSurface3} />
          </Pressable>
        </View>

        <View style={styles.chipRowWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {KIND_CHIPS.map((c) => (
              <Chip
                key={c.key}
                testID={`search-kind-chip-${c.key}`}
                label={c.label}
                active={kind === c.key}
                onPress={() => setKind(c.key)}
              />
            ))}
            {formats.map((f) => (
              <Chip
                key={f}
                testID={`search-format-chip-${f}`}
                label={f}
                active={format === f}
                onPress={() => setFormat(format === f ? null : f)}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => <AudioListItem file={item} />}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text style={styles.resultCount} testID="search-result-count">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </Text>
        }
        ListEmptyComponent={
          <EmptyState
            testID="search-empty-state"
            icon="search"
            title="Nothing matched your search"
            body="Try another keyword or remove some filters."
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters & Sort" testID="filter-sheet">
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
          <Text style={styles.sheetSection}>Duration</Text>
          {DURATION_CHIPS.map((dl) => (
            <SheetOption
              key={dl}
              testID={`filter-duration-${dl}`}
              label={dl}
              selected={duration === dl}
              onPress={() => setDuration(duration === dl ? null : dl)}
            />
          ))}
          <Text style={styles.sheetSection}>Sort by</Text>
          {SORTS.map((s) => (
            <SheetOption
              key={s.key}
              testID={`sort-option-${s.key}`}
              label={s.label}
              selected={sort === s.key}
              onPress={() => setSort(s.key)}
            />
          ))}
          <Pressable
            testID="filter-reset-button"
            onPress={() => { setKind('all'); setFormat(null); setDuration(null); setSort('dateAdded'); }}
            style={styles.resetBtn}
          >
            <Text style={styles.resetText}>Reset all filters</Text>
          </Pressable>
        </ScrollView>
      </Sheet>

      <SelectionBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surface, paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xxl, paddingHorizontal: spacing.lg },
  searchRow: {
    flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, minHeight: 48,
  },
  input: { flex: 1, color: colors.onSurface, fontFamily: font.regular, fontSize: type.base, paddingVertical: 12 },
  filterBtn: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surface2,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  chipRowWrap: { height: 56 },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' },
  resultCount: {
    color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  sheetSection: {
    color: colors.onSurface2, fontFamily: font.semibold, fontSize: type.sm,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  resetBtn: { paddingVertical: spacing.lg, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  resetText: { color: colors.error, fontFamily: font.medium, fontSize: type.base },
});
