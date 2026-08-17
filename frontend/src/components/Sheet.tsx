import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, spacing, type } from '@/src/theme';

export function Sheet({ visible, onClose, title, children, testID }: {
  visible: boolean; onClose: () => void; title: string;
  children: React.ReactNode; testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID={testID}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} testID={testID ? `${testID}-close` : undefined}>
              <Ionicons name="close" size={22} color={colors.onSurface2} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function SheetOption({ label, selected, onPress, testID }: {
  label: string; selected?: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.option} testID={testID}>
      <Text style={[styles.optionText, selected && { color: colors.onBrandTint }]}>{label}</Text>
      {selected && <Ionicons name="checkmark" size={20} color={colors.brand2} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: colors.surface2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, maxHeight: '80%',
    borderTopWidth: 1, borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.borderStrong, marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontFamily: font.semibold, fontSize: type.xl },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, minHeight: 48,
  },
  optionText: { color: colors.onSurface3, fontFamily: font.medium, fontSize: type.lg },
});
