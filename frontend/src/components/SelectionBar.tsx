import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibrary } from '@/src/context/LibraryContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { formatBytes } from '@/src/utils/format';

export function SelectionBar({ insideTabs = true }: { insideTabs?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selection, totalSelectedSize, clearSelection } = useLibrary();

  if (selection.size === 0) return null;

  const bottom = insideTabs ? spacing.lg : insets.bottom + spacing.lg;
  const Wrapper = Platform.OS === 'web' ? View : BlurView;
  const wrapperProps = Platform.OS === 'web' ? {} : { intensity: 40, tint: 'dark' as const };

  return (
    <View style={[styles.holder, { bottom }]} pointerEvents="box-none">
      <Wrapper {...wrapperProps} style={styles.bar}>
        <Pressable onPress={clearSelection} hitSlop={10} testID="selection-clear-button">
          <Ionicons name="close-circle" size={24} color={colors.onSurface2} />
        </Pressable>
        <View style={styles.info}>
          <Text style={styles.count} testID="selection-count-text">{selection.size} Selected</Text>
          <Text style={styles.size}>
            {selection.size} {selection.size === 1 ? 'file' : 'files'}
            {totalSelectedSize > 0 ? ` • ${formatBytes(totalSelectedSize)}` : ''}
          </Text>
        </View>
        <Pressable
          testID="selection-push-button"
          onPress={() => router.push('/push-config')}
          style={({ pressed }) => [styles.pushBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="cloud-upload" size={16} color={colors.white} />
          <Text style={styles.pushText}>Push</Text>
        </Pressable>
      </Wrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  holder: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: Platform.OS === 'web' ? 'rgba(34,34,37,0.96)' : 'rgba(22,22,24,0.75)',
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, overflow: 'hidden',
  },
  info: { flex: 1 },
  count: { color: colors.onSurface, fontFamily: font.semibold, fontSize: type.lg },
  size: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm },
  pushBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, minHeight: 44,
  },
  pushText: { color: colors.white, fontFamily: font.semibold, fontSize: type.lg },
});
