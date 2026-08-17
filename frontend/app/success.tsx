import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TRANSCRIBE_WEB_URL } from '@/src/api/client';
import { GhostButton, PrimaryButton } from '@/src/components/common';
import { useToast } from '@/src/context/ToastContext';
import { colors, font, spacing, type } from '@/src/theme';

export default function Success() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { count } = useLocalSearchParams<{ count?: string }>();
  const { showToast } = useToast();
  const n = parseInt(count || '1', 10) || 1;

  const openWebsite = () => {
    if (TRANSCRIBE_WEB_URL) {
      Linking.openURL(TRANSCRIBE_WEB_URL).catch(() =>
        showToast("Couldn't open the website. Check the configured URL.", 'error'));
    } else {
      showToast('tunAide Transcribe web URL is not configured yet. Set EXPO_PUBLIC_TRANSCRIBE_WEB_URL.', 'info');
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + spacing.xl }]} testID="success-screen">
      <View style={styles.center}>
        <View style={styles.glowWrap}>
          <View style={styles.glow} />
          <View style={styles.check}>
            <Ionicons name="checkmark" size={54} color={colors.white} />
          </View>
        </View>
        <Text style={styles.title} testID="success-title">Pushed Successfully!</Text>
        <Text style={styles.body}>
          {n} {n === 1 ? 'file has' : 'files have'} been uploaded.
          {'\n'}Added to the shared transcription queue. Track status in Activity.
        </Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton
          testID="success-view-website-button"
          label="View on Website"
          icon="globe"
          onPress={openWebsite}
        />
        <GhostButton
          testID="success-back-library-button"
          label="Back to Library"
          onPress={() => router.replace('/(tabs)')}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glowWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  glow: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  check: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.hero, textAlign: 'center' },
  body: {
    color: colors.onSurface2, fontFamily: font.regular, fontSize: type.lg,
    textAlign: 'center', marginTop: spacing.md, lineHeight: 24,
  },
  footer: {},
});
