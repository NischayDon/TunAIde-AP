import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ProgressBar } from '@/src/components/common';
import { UploadJob, useUploads } from '@/src/context/UploadContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { formatBytes } from '@/src/utils/format';

const ACTIVE = ['preparing', 'uploading', 'processing'];

export default function Queue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jobs, cancelJob, retryJob, removeJob, startQueue, activeCount, queuedCount } = useUploads();
  const hadWorkRef = useRef(false);

  const sections = useMemo(() => {
    const uploading = jobs.filter((j) => ACTIVE.includes(j.status));
    const queued = jobs.filter((j) => j.status === 'queued');
    const failed = jobs.filter((j) => j.status === 'failed');
    const done = jobs.filter((j) => j.status === 'complete');
    const cancelled = jobs.filter((j) => j.status === 'cancelled');
    return [
      { title: 'Uploading', data: uploading },
      { title: 'Queued', data: queued },
      { title: 'Failed', data: failed },
      { title: 'Complete', data: done },
      { title: 'Cancelled', data: cancelled },
    ].filter((s) => s.data.length > 0);
  }, [jobs]);

  // Auto-navigate to success once an in-flight batch fully completes.
  useEffect(() => {
    const pending = jobs.filter((j) => ACTIVE.includes(j.status) || j.status === 'queued');
    const failed = jobs.filter((j) => j.status === 'failed');
    const complete = jobs.filter((j) => j.status === 'complete');
    if (pending.length > 0) hadWorkRef.current = true;
    if (hadWorkRef.current && pending.length === 0 && failed.length === 0 && complete.length > 0) {
      hadWorkRef.current = false;
      router.replace(`/success?count=${complete.length}`);
    }
  }, [jobs, router]);

  const renderJob = ({ item }: { item: UploadJob }) => {
    const active = ACTIVE.includes(item.status);
    return (
      <View style={styles.jobRow} testID={`queue-job-${item.id}`}>
        <View style={styles.jobHeader}>
          <Text style={styles.jobName} numberOfLines={1}>{item.file.fileName}</Text>
          <View style={styles.jobActions}>
            {(active || item.status === 'queued') && (
              <Pressable testID={`queue-cancel-${item.id}`} onPress={() => cancelJob(item.id)} hitSlop={8} style={styles.actionBtn}>
                <Ionicons name="close" size={16} color={colors.onSurface2} />
              </Pressable>
            )}
            {(item.status === 'failed' || item.status === 'cancelled') && (
              <Pressable testID={`queue-retry-${item.id}`} onPress={() => retryJob(item.id)} hitSlop={8} style={styles.actionBtn}>
                <Ionicons name="refresh" size={16} color={colors.brand2} />
              </Pressable>
            )}
            {['failed', 'cancelled', 'complete'].includes(item.status) && (
              <Pressable testID={`queue-remove-${item.id}`} onPress={() => removeJob(item.id)} hitSlop={8} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={15} color={colors.onSurface2} />
              </Pressable>
            )}
          </View>
        </View>

        {active && (
          <>
            <View style={styles.progressRow}>
              <ProgressBar progress={item.status === 'uploading' ? item.progress : 0.03} />
              <Text style={styles.pct}>
                {item.status === 'uploading' ? `${Math.round(item.progress * 100)}%` : '…'}
              </Text>
            </View>
            <Text style={styles.jobSub}>
              {item.status === 'preparing'
                ? 'Preparing…'
                : `${formatBytes(item.uploadedBytes)} / ${formatBytes(item.totalBytes || item.file.size)}`}
            </Text>
          </>
        )}
        {item.status === 'queued' && <Text style={styles.jobSub}>Waiting in queue</Text>}
        {item.status === 'complete' && (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={[styles.jobSub, { color: colors.success }]}>Uploaded to tunAide Transcribe</Text>
          </View>
        )}
        {item.status === 'failed' && (
          <View style={styles.statusRow}>
            <Ionicons name="alert-circle" size={14} color={colors.error} />
            <Text style={[styles.jobSub, { color: colors.error }]} numberOfLines={2}>
              {item.error || 'Upload failed. Tap retry.'}
            </Text>
          </View>
        )}
        {item.status === 'cancelled' && <Text style={styles.jobSub}>Cancelled</Text>}
      </View>
    );
  };

  return (
    <View style={styles.container} testID="queue-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="queue-back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.onSurface3} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Upload Queue</Text>
          <Text style={styles.sub}>
            {activeCount > 0 ? `${activeCount} uploading · ${queuedCount} queued` : `${queuedCount} queued`}
          </Text>
        </View>
        {queuedCount > 0 && activeCount === 0 && (
          <Pressable testID="queue-start-button" onPress={startQueue} style={styles.startBtn}>
            <Ionicons name="play" size={14} color={colors.white} />
            <Text style={styles.startText}>Start</Text>
          </Pressable>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(j) => j.id}
        renderItem={renderJob}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        ListEmptyComponent={
          <EmptyState
            testID="queue-empty-state"
            icon="cloud-done"
            title="Queue is empty"
            body="Select audio files in your library and push them to tunAide Transcribe."
            actionLabel="Back to Library"
            onAction={() => router.replace('/(tabs)')}
          />
        }
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
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
  title: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xl },
  sub: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: 40,
  },
  startText: { color: colors.white, fontFamily: font.semibold, fontSize: type.base },
  sectionHeader: {
    color: colors.onSurface2, fontFamily: font.semibold, fontSize: type.sm,
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm,
  },
  jobRow: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg,
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  jobHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  jobName: { flex: 1, color: colors.onSurface, fontFamily: font.medium, fontSize: type.base },
  jobActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.surface3,
    alignItems: 'center', justifyContent: 'center',
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  pct: { color: colors.onSurface3, fontFamily: font.semibold, fontSize: type.sm, width: 38, textAlign: 'right' },
  jobSub: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
});
