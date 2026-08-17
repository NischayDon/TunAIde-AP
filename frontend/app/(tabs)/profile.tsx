import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TRANSCRIBE_WEB_URL } from '@/src/api/client';
import { useLibrary } from '@/src/context/LibraryContext';
import { useToast } from '@/src/context/ToastContext';
import { colors, font, radius, spacing, type } from '@/src/theme';

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { files, favorites } = useLibrary();
  const { showToast } = useToast();

  const openWebsite = () => {
    if (TRANSCRIBE_WEB_URL) {
      Linking.openURL(TRANSCRIBE_WEB_URL).catch(() =>
        showToast("Couldn't open the website. Check the configured URL.", 'error'));
    } else {
      showToast('tunAide Transcribe web URL is not configured yet. Set EXPO_PUBLIC_TRANSCRIBE_WEB_URL.', 'info');
    }
  };

  return (
    <View style={styles.container} testID="profile-screen">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AP</Text>
          </View>
          <Text style={styles.name} testID="profile-name">tunAide AP</Text>
          <Text style={styles.email} testID="profile-subtitle">Audio Pusher · This device</Text>
        </View>

        <View style={styles.connectCard} testID="profile-connection-card">
          <View style={styles.connectRow}>
            <View style={styles.dot} />
            <Text style={styles.connectTitle}>tunAide Transcribe</Text>
          </View>
          <Text style={styles.connectSub}>Connected · My Workspace</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{files.length}</Text>
            <Text style={styles.statLabel}>Audio files</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{favorites.size}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
        </View>

        <View style={styles.menu}>
          <Pressable testID="profile-settings-button" style={styles.menuRow} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={20} color={colors.onSurface3} />
            <Text style={styles.menuText}>Account Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.onSurface2} />
          </Pressable>
          <Pressable testID="profile-website-button" style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={openWebsite}>
            <Ionicons name="globe-outline" size={20} color={colors.onSurface3} />
            <Text style={styles.menuText}>Transcribe Website</Text>
            <Ionicons name="open-outline" size={16} color={colors.onSurface2} />
          </Pressable>
        </View>

        <Text style={styles.version}>tunAide AP · Audio Pusher · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerBlock: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brandTint,
    borderWidth: 2, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.onBrandTint, fontFamily: font.bold, fontSize: 34 },
  name: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xl },
  email: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.base, marginTop: 2 },
  connectCard: {
    marginHorizontal: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface2,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  connectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  connectTitle: { color: colors.onSurface, fontFamily: font.semibold, fontSize: type.lg },
  connectSub: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md },
  statCard: {
    flex: 1, padding: spacing.lg, backgroundColor: colors.surface2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  statNum: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xxl },
  statLabel: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 2 },
  menu: {
    marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.surface2,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  menuText: { flex: 1, color: colors.onSurface3, fontFamily: font.medium, fontSize: type.lg },
  version: {
    color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm,
    textAlign: 'center', marginTop: spacing.xxl,
  },
  confirmBody: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.base, lineHeight: 21 },
});
