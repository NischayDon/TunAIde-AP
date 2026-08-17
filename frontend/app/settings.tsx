import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibrary } from '@/src/context/LibraryContext';
import { useToast } from '@/src/context/ToastContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { storage } from '@/src/utils/storage';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rescan, files, scanning } = useLibrary();
  const { showToast } = useToast();

  const [wifiOnly, setWifiOnly] = useState(false);
  const [autoRetry, setAutoRetry] = useState(true);

  useEffect(() => {
    storage.getItem('tunaide.settings.wifiOnly', false).then((v) => setWifiOnly(v === true));
    storage.getItem('tunaide.settings.autoRetry', true).then((v) => setAutoRetry(v !== false));
  }, []);

  const toggleWifi = (v: boolean) => {
    setWifiOnly(v);
    storage.setItem('tunaide.settings.wifiOnly', v);
  };
  const toggleRetry = (v: boolean) => {
    setAutoRetry(v);
    storage.setItem('tunaide.settings.autoRetry', v);
  };

  const doRescan = async () => {
    showToast('Rescanning your device for audio…', 'info');
    await rescan();
    showToast('Library updated.', 'success');
  };

  return (
    <View style={styles.container} testID="settings-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="settings-back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.onSurface3} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>Library</Text>
        <View style={styles.card}>
          <Pressable testID="settings-rescan-button" style={styles.row} onPress={doRescan}>
            <Ionicons name="refresh" size={19} color={scanning ? colors.brand2 : colors.onSurface3} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>Rescan device</Text>
              <Text style={styles.rowSub}>{files.length} audio files indexed</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.onSurface2} />
          </Pressable>
          {Platform.OS === 'web' && (
            <View style={styles.row}>
              <Ionicons name="information-circle-outline" size={19} color={colors.warning} />
              <Text style={[styles.rowSub, { flex: 1 }]}>
                Web preview uses a sample library. Device scanning works on Android/iOS.
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.section}>Uploads</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="wifi" size={19} color={colors.onSurface3} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>Wi-Fi only</Text>
              <Text style={styles.rowSub}>Pause uploads on mobile data</Text>
            </View>
            <Switch
              testID="settings-wifi-only-switch"
              value={wifiOnly}
              onValueChange={toggleWifi}
              trackColor={{ false: colors.surface3, true: colors.brand }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.row}>
            <Ionicons name="repeat" size={19} color={colors.onSurface3} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>Auto-retry failed uploads</Text>
              <Text style={styles.rowSub}>Retry once automatically on failure</Text>
            </View>
            <Switch
              testID="settings-auto-retry-switch"
              value={autoRetry}
              onValueChange={toggleRetry}
              trackColor={{ false: colors.surface3, true: colors.brand }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <Text style={styles.section}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="moon" size={19} color={colors.onSurface3} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>Dark</Text>
              <Text style={styles.rowSub}>tunAide AP is a dark-first interface</Text>
            </View>
            <Ionicons name="checkmark" size={18} color={colors.brand2} />
          </View>
        </View>

        <Text style={styles.section}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="pulse" size={19} color={colors.brand2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>tunAide AP — Audio Pusher</Text>
              <Text style={styles.rowSub}>Version 1.0.0 · Smart Audio. Organized. Push to Transcribe.</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.onSurface3} />
            <Text style={[styles.rowSub, { flex: 1 }]}>
              Your audio stays on this device. Files are only uploaded when you explicitly press Push.
            </Text>
          </View>
        </View>
      </ScrollView>
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
  title: { flex: 1, color: colors.onSurface, fontFamily: font.bold, fontSize: type.xl, textAlign: 'center' },
  section: {
    color: colors.onSurface2, fontFamily: font.semibold, fontSize: type.sm,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  rowText: { color: colors.onSurface3, fontFamily: font.medium, fontSize: type.base },
  rowSub: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, marginTop: 1 },
});
