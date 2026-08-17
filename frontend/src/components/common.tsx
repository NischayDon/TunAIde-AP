import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, font, radius, spacing, type } from '@/src/theme';

export function PrimaryButton({ label, onPress, disabled, loading, testID, style, icon }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  testID?: string; style?: ViewStyle; icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.primary, style,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : (
        <View style={styles.btnRow}>
          {icon && <Ionicons name={icon} size={18} color={colors.white} />}
          <Text style={styles.primaryText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function GhostButton({ label, onPress, testID, style, danger }: {
  label: string; onPress: () => void; testID?: string; style?: ViewStyle; danger?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, style, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.ghostText, danger && { color: colors.error }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, testID }: {
  label: string; active?: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ progress, color = colors.brand, height = 6 }: {
  progress: number; color?: string; height?: number;
}) {
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={{
        width: `${Math.max(0, Math.min(100, progress * 100))}%`,
        backgroundColor: color, height, borderRadius: height / 2,
      }} />
    </View>
  );
}

export function EmptyState({ icon, title, body, actionLabel, onAction, testID }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; body: string;
  actionLabel?: string; onAction?: () => void; testID?: string;
}) {
  return (
    <View style={styles.empty} testID={testID}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.onBrandTint} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionLabel && onAction && (
        <PrimaryButton
          label={actionLabel}
          onPress={onAction}
          style={{ marginTop: spacing.lg, alignSelf: 'center', paddingHorizontal: spacing.xl }}
          testID={testID ? `${testID}-action` : undefined}
        />
      )}
    </View>
  );
}

export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: {
  title: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: colors.brand, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primaryText: { color: colors.white, fontFamily: font.semibold, fontSize: type.lg },
  ghost: {
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', minHeight: 48,
    justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  ghostText: { color: colors.onSurface3, fontFamily: font.medium, fontSize: type.lg },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  chipText: { color: colors.onSurface2, fontFamily: font.medium, fontSize: type.base },
  chipTextActive: { color: colors.onBrandTint },
  track: { backgroundColor: colors.surface3, overflow: 'hidden', flex: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  emptyTitle: { color: colors.onSurface, fontFamily: font.semibold, fontSize: type.xl, marginBottom: spacing.sm, textAlign: 'center' },
  emptyBody: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.base, textAlign: 'center', lineHeight: 20 },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
    gap: spacing.lg,
  },
  metaLabel: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.base },
  metaValue: { color: colors.onSurface3, fontFamily: font.medium, fontSize: type.base, flexShrink: 1, textAlign: 'right' },
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.onSurface, fontFamily: font.semibold, fontSize: type.lg },
  sectionAction: { color: colors.brand2, fontFamily: font.medium, fontSize: type.base },
});
