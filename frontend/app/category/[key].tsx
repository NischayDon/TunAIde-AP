import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioListItem } from '@/src/components/AudioListItem';
import { EmptyState } from '@/src/components/common';
import { SelectionBar } from '@/src/components/SelectionBar';
import { Sheet, SheetOption } from '@/src/components/Sheet';
import { useLibrary } from '@/src/context/LibraryContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { resolveCategory, SortKey, sortFiles } from '@/src/utils/audioMeta';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'dateAdded', label: 'Date added' },
  { key: 'name', label: 'Name' },
  { key: 'artist', label: 'Artist' },
  { key: 'duration', label: 'Duration' },
  { key: 'size', label: 'File size' },
  { key: 'format', label: 'Format' },
];

export default function CategoryView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { files, favorites, selectMany } = useLibrary();
  const [sort, setSort] = useState<SortKey>('dateAdded');
  const [sortOpen, setSortOpen] = useState(false);

  const category = useMemo(
    () => resolveCategory(decodeURIComponent(key || 'all'), files, favorites),
    [key, files, favorites],
  );

  const sorted = useMemo(
    () => (category.mode === 'files' ? sortFiles(category.files, sort) : []),
    [category, sort],
  );

  return (
    <View style={styles.container} testID="category-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="category-back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.onSurface3} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{category.title}</Text>
          <Text style={styles.count}>
            {category.mode === 'files'
              ? `${category.files.length} ${category.files.length === 1 ? 'file' : 'files'}`
              : `${category.groups.length} groups`}
          </Text>
        </View>
        {category.mode === 'files' && category.files.length > 0 && (
          <>
            <Pressable
              testID="category-select-all-button"
              onPress={() => selectMany(category.files.map((f) => f.id))}
              style={styles.headerBtn}
              hitSlop={6}
            >
              <Ionicons name="checkmark-done" size={18} color={colors.onSurface3} />
            </Pressable>
            <Pressable
              testID="category-sort-button"
              onPress={() => setSortOpen(true)}
              style={styles.headerBtn}
              hitSlop={6}
            >
              <Ionicons name="swap-vertical" size={18} color={colors.onSurface3} />
            </Pressable>
          </>
        )}
      </View>

      {category.mode === 'groups' ? (
        <FlatList
          data={category.groups}
          keyExtractor={(g) => g.key}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item }) => (
            <Pressable
              testID={`group-row-${item.label}`}
              style={({ pressed }) => [styles.groupRow, pressed && { backgroundColor: colors.surface2 }]}
              onPress={() => router.push(`/category/${encodeURIComponent(item.key)}`)}
            >
              <View style={styles.groupIcon}>
                <Ionicons name="folder" size={18} color={colors.onBrandTint} />
              </View>
              <Text style={styles.groupLabel} numberOfLines={1}>{item.label}</Text>
              <Text style={styles.groupCount}>{item.count}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.onSurface2} />
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState icon="folder-open" title="Nothing here" body="No audio files match this group yet." />
          }
        />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(f) => f.id}
          renderItem={({ item }) => <AudioListItem file={item} />}
          contentContainerStyle={{ paddingBottom: 140 }}
          ListEmptyComponent={
            <EmptyState
              testID="category-empty-state"
              icon="folder-open"
              title="Nothing here yet"
              body={category.title === 'Favorites'
                ? 'Tap the heart on any audio file to add it to Favorites.'
                : 'No audio files match this category yet.'}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort by" testID="sort-sheet">
        {SORTS.map((s) => (
          <SheetOption
            key={s.key}
            testID={`category-sort-${s.key}`}
            label={s.label}
            selected={sort === s.key}
            onPress={() => { setSort(s.key); setSortOpen(false); }}
          />
        ))}
      </Sheet>

      <SelectionBar insideTabs={false} />
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
  headerBtn: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  title: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xl },
  count: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm },
  groupRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 60,
  },
  groupIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  groupLabel: { flex: 1, color: colors.onSurface, fontFamily: font.medium, fontSize: type.lg },
  groupCount: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.base },
});
