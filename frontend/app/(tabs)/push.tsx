import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, PrimaryButton } from '@/src/components/common';
import { useLibrary } from '@/src/context/LibraryContext';
import { useUploads } from '@/src/context/UploadContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { formatBytes, formatDuration } from '@/src/utils/format';

export default function PushTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedFiles, totalSelectedSize, toggleSelect, clearSelection } = useLibrary();
  const { activeCount, queuedCount, jobs } = useUploads();

  const queueRow = (activeCount + queuedCount > 0 || jobs.length > 0) && (
    <Pressable
      testID="push-view-queue-button"
      style={styles.queueRow}
      onPress={() => router.push('/queue')}
    >
      <View style={styles.queueIcon}>
        <Ionicons name="layers" size={18} color={colors.onBrandTint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.queueTitle}>Upload Queue</Text>
        <Text style={styles.queueSub}>
          {activeCount > 0
            ? `${activeCount} uploading · ${queuedCount} queued`
            : queuedCount > 0
              ? `${queuedCount} queued`
              : 'View recent upload activity'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.onSurface2} />
    </Pressable>
  );

  return (
    <View style={styles.container} testID="push-tab-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Push</Text>
        <Text style={styles.subtitle}>Selected audio, ready for tunAide Transcribe</Text>
      </View>

      {selectedFiles.length === 0 ? (
        <View style={{ flex: 1 }}>
          {queueRow}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              testID="push-empty-state"
              icon="cloud-upload"
              title="Nothing selected yet"
              body="Select audio files in your library — long-press any file to start selecting — then push them to tunAide Transcribe."
              actionLabel="Browse Library"
              onAction={() => router.push('/(tabs)')}
            />
          </View>
        </View>
      ) : (
        <>
          {queueRow}
          <FlatList
            data={selectedFiles}
            keyExtractor={(f) => f.id}
            contentContainerStyle={{ paddingBottom: 200, paddingTop: spacing.sm }}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="musical-note" size={18} color={colors.onBrandTint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.fileName}</Text>
                  <Text style={styles.rowSub}>
                    {item.format} · {formatDuration(item.duration)}
                    {item.size > 0 ? ` · ${formatBytes(item.size)}` : ''}
                  </Text>
                </View>
                <Pressable
                  testID={`push-remove-${item.id}`}
                  onPress={() => toggleSelect(item.id)}
                  hitSlop={8}
                  style={styles.removeBtn}
                >
                  <Ionicons name="close" size={18} color={colors.onSurface2} />
                </Pressable>
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
          <View style={[styles.footer, { paddingBottom: spacing.lg }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText} testID="push-summary-text">
                {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}
                {totalSelectedSize > 0 ? ` • ${formatBytes(totalSelectedSize)}` : ''}
              </Text>
              <Pressable onPress={clearSelection} hitSlop={8} testID="push-clear-selection-button">
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            </View>
            <PrimaryButton
              testID="push-configure-button"
              label="Push to tunAide Transcribe"
              icon="cloud-upload"
              onPress={() => router.push('/push-config')}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xxl },
  subtitle: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 2 },
  queueRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg,
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  queueIcon: {
    width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  queueTitle: { color: colors.onSurface, fontFamily: font.semibold, fontSize: type.base },
  queueSub: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 60,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { color: colors.onSurface, fontFamily: font.medium, fontSize: type.base },
  rowSub: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 1 },
  removeBtn: {
    width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.surface3,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryText: { color: colors.onSurface3, fontFamily: font.semibold, fontSize: type.lg },
  clearText: { color: colors.error, fontFamily: font.medium, fontSize: type.base },
});
