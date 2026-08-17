import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GhostButton, PrimaryButton } from '@/src/components/common';
import { useLibrary } from '@/src/context/LibraryContext';
import { useToast } from '@/src/context/ToastContext';
import { useUploads } from '@/src/context/UploadContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { formatBytes } from '@/src/utils/format';

const QUALITIES = [
  { key: 'original', label: 'Original', hint: 'Recommended' },
  { key: 'compressed', label: 'Compressed', hint: 'Smaller upload' },
];
const PRIORITIES = [
  { key: 'normal', label: 'Normal' },
  { key: 'high', label: 'High' },
];

export default function PushConfig() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedFiles, totalSelectedSize, clearSelection } = useLibrary();
  const { enqueue } = useUploads();
  const { showToast } = useToast();

  const [quality, setQuality] = useState('original');
  const [priority, setPriority] = useState('normal');
  const [note, setNote] = useState('');

  if (selectedFiles.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.emptyText}>No files selected.</Text>
        <GhostButton label="Go Back" onPress={() => router.back()} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.xxl }} />
      </View>
    );
  }

  const startPush = (autoStart: boolean) => {
    enqueue(selectedFiles, { note: note.trim(), quality, priority }, autoStart);
    clearSelection();
    if (autoStart) {
      router.replace('/queue');
    } else {
      showToast(`${selectedFiles.length} ${selectedFiles.length === 1 ? 'file' : 'files'} added to the upload queue.`, 'success');
      router.back();
    }
  };

  const shown = selectedFiles.slice(0, 4);

  return (
    <View style={styles.container} testID="push-config-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="push-config-close-button" onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={20} color={colors.onSurface3} />
        </Pressable>
        <Text style={styles.headerTitle}>Push to tunAide Transcribe</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }}
        bottomOffset={140}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard} testID="push-config-summary">
          <View style={styles.summaryTop}>
            <View style={styles.summaryIcon}>
              <Ionicons name="cloud-upload" size={22} color={colors.onBrandTint} />
            </View>
            <View>
              <Text style={styles.summaryTitle}>
                {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
              </Text>
              <Text style={styles.summarySub}>
                {totalSelectedSize > 0 ? `Total ${formatBytes(totalSelectedSize)}` : 'Size calculated during upload'}
              </Text>
            </View>
          </View>
          {shown.map((f) => (
            <Text key={f.id} style={styles.summaryFile} numberOfLines={1}>· {f.fileName}</Text>
          ))}
          {selectedFiles.length > shown.length && (
            <Text style={styles.summaryFile}>+ {selectedFiles.length - shown.length} more</Text>
          )}
        </View>

        <Text style={styles.sectionLabel}>Upload Quality</Text>
        <View style={styles.segmentRow}>
          {QUALITIES.map((q) => (
            <Pressable
              key={q.key}
              testID={`quality-option-${q.key}`}
              style={[styles.segment, quality === q.key && styles.segmentActive]}
              onPress={() => setQuality(q.key)}
            >
              <Text style={[styles.segmentLabel, quality === q.key && { color: colors.onBrandTint }]}>{q.label}</Text>
              <Text style={styles.segmentHint}>{q.hint}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Priority</Text>
        <View style={styles.segmentRow}>
          {PRIORITIES.map((p) => (
            <Pressable
              key={p.key}
              testID={`priority-option-${p.key}`}
              style={[styles.segment, priority === p.key && styles.segmentActive]}
              onPress={() => setPriority(p.key)}
            >
              <Text style={[styles.segmentLabel, priority === p.key && { color: colors.onBrandTint }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Add Note (optional)</Text>
        <TextInput
          testID="push-note-input"
          style={styles.noteInput}
          placeholder="e.g. Lecture - Marketing 101"
          placeholderTextColor={colors.onSurface2}
          value={note}
          onChangeText={setNote}
          maxLength={140}
        />

        <Text style={styles.sectionLabel}>Destination</Text>
        <View style={styles.destRow} testID="push-destination-row">
          <Ionicons name="briefcase" size={18} color={colors.onBrandTint} />
          <Text style={styles.destText}>My tunAide Transcribe Workspace</Text>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton
          testID="push-now-button"
          label="Push Now"
          icon="cloud-upload"
          onPress={() => startPush(true)}
        />
        <GhostButton
          testID="add-to-queue-button"
          label="Add to Queue"
          onPress={() => startPush(false)}
          style={{ marginTop: spacing.md }}
        />
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
  closeBtn: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { flex: 1, color: colors.onSurface, fontFamily: font.semibold, fontSize: type.lg, textAlign: 'center' },
  emptyText: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.lg },
  summaryCard: {
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.xl,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  summaryIcon: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryTitle: { color: colors.onSurface, fontFamily: font.semibold, fontSize: type.lg },
  summarySub: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 1 },
  summaryFile: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 3 },
  sectionLabel: {
    color: colors.onSurface2, fontFamily: font.semibold, fontSize: type.sm,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm,
  },
  segmentRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  segment: {
    flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, minHeight: 52, justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  segmentLabel: { color: colors.onSurface3, fontFamily: font.semibold, fontSize: type.base },
  segmentHint: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 1 },
  noteInput: {
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    color: colors.onSurface, fontFamily: font.regular, fontSize: type.base,
    paddingHorizontal: spacing.lg, paddingVertical: 14, minHeight: 50, marginBottom: spacing.xl,
  },
  destRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, minHeight: 54,
  },
  destText: { flex: 1, color: colors.onSurface3, fontFamily: font.medium, fontSize: type.base },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
});
