import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ProgressBar } from '@/src/components/common';
import { activityApi, ServerUpload } from '@/src/api/client';
import { useUploads } from '@/src/context/UploadContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { formatBytes, formatDuration, timeAgo } from '@/src/utils/format';

export default function Activity() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jobs, activeCount, queuedCount } = useUploads();
  const [uploads, setUploads] = useState<ServerUpload[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await activityApi.uploads();
      setUploads(u);
      setOffline(false);
    } catch (e) {
      if (e instanceof Error && e.message === 'offline') setOffline(true);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRetry = async (id: string) => {
    try {
      await activityApi.retryPublish(id);
      load();
    } catch (e) {
      // ignore
    }
  };

  const activeJobs = useMemo(
    () => jobs.filter((j) => ['queued', 'preparing', 'uploading', 'processing', 'failed'].includes(j.status)),
    [jobs],
  );

  const header = (
    <View>
      {offline && (
        <View style={styles.offlineBanner} testID="activity-offline-banner">
          <Ionicons name="cloud-offline" size={16} color={colors.warning} />
          <Text style={styles.offlineText}>{"You're offline — showing the latest cached activity."}</Text>
        </View>
      )}
      {activeJobs.length > 0 && (
        <Pressable style={styles.liveCard} onPress={() => router.push('/queue')} testID="activity-live-queue-card">
          <View style={styles.liveHeader}>
            <Text style={styles.liveTitle}>
              {activeCount > 0 ? 'Uploading' : queuedCount > 0 ? 'Queued' : 'Needs attention'}
            </Text>
            <Text style={styles.liveLink}>Open queue</Text>
          </View>
          {activeJobs.slice(0, 3).map((j) => (
            <View key={j.id} style={{ marginTop: spacing.sm }}>
              <View style={styles.liveRow}>
                <Text style={styles.liveFile} numberOfLines={1}>{j.file.fileName}</Text>
                <Text style={styles.livePct}>
                  {j.status === 'uploading' ? `${Math.round(j.progress * 100)}%` : j.status}
                </Text>
              </View>
              <ProgressBar
                progress={j.status === 'uploading' ? j.progress : j.status === 'failed' ? 1 : 0.02}
                color={j.status === 'failed' ? colors.error : colors.brand}
              />
            </View>
          ))}
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.container} testID="activity-screen">
      <View style={[styles.headerWrap, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Activity</Text>
      </View>

        <FlatList
          data={uploads}
          keyExtractor={(u) => u.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand2} />}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`upload-history-${item.id}`}>
              <View style={[styles.rowIcon, { backgroundColor: item.queue_status === 'PUBLISH_FAILED' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' }]}>
                <Ionicons name={item.queue_status === 'PUBLISH_FAILED' ? 'warning' : 'checkmark-done'} size={18} color={item.queue_status === 'PUBLISH_FAILED' ? colors.error : colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.file_name}</Text>
                <Text style={styles.rowSub}>
                  {formatBytes(item.size)} · {timeAgo(item.created_at)}
                  {item.is_duplicate ? ' · duplicate' : ''}
                </Text>
                {item.queue_status === 'PUBLISH_FAILED' && item.phase_one_error && (
                  <Text style={[styles.rowSub, { color: colors.error, fontSize: 11 }]}>{item.phase_one_error}</Text>
                )}
              </View>
              {item.queue_status === 'PUBLISH_FAILED' ? (
                <Pressable style={[styles.pill, { backgroundColor: colors.brandTint }]} onPress={() => handleRetry(item.id)}>
                  <Text style={[styles.pillText, { color: colors.onBrandTint }]}>Retry</Text>
                </Pressable>
              ) : (
                <View style={[styles.pill, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                  <Text style={[styles.pillText, { color: colors.success }]}>
                    {item.queue_status === 'PUBLISHED' ? 'In Queue' : item.queue_status === 'PUBLISHING' ? 'Publishing...' : 'Uploaded'}
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={activeJobs.length === 0 ? (
            <EmptyState
              testID="uploads-empty-state"
              icon="cloud-upload"
              title="Nothing pushed yet"
              body="Select an audio file and push it to TunAIde."
            />
          ) : null}
          showsVerticalScrollIndicator={false}
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerWrap: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xxl, marginBottom: spacing.md },
  segment: {
    flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md,
    padding: 3, borderWidth: 1, borderColor: colors.border,
  },
  segmentBtn: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', borderRadius: radius.sm + 2, minHeight: 40, justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.brandTint },
  segmentText: { color: colors.onSurface2, fontFamily: font.medium, fontSize: type.base },
  segmentTextActive: { color: colors.onBrandTint },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md,
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  offlineText: { color: colors.warning, fontFamily: font.regular, fontSize: type.sm, flex: 1 },
  liveCard: {
    marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.lg,
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  liveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTitle: { color: colors.onSurface, fontFamily: font.semibold, fontSize: type.lg },
  liveLink: { color: colors.brand2, fontFamily: font.medium, fontSize: type.sm },
  liveRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: spacing.md },
  liveFile: { color: colors.onSurface3, fontFamily: font.regular, fontSize: type.sm, flex: 1 },
  livePct: { color: colors.onSurface2, fontFamily: font.medium, fontSize: type.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 64,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { color: colors.onSurface, fontFamily: font.medium, fontSize: type.base },
  rowSub: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 1 },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { fontFamily: font.semibold, fontSize: type.sm },
});
