import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GhostButton, PrimaryButton } from '@/src/components/common';
import { useLibrary } from '@/src/context/LibraryContext';
import { colors, font, radius, spacing, type } from '@/src/theme';

type Stage = 'explain' | 'scanning' | 'done' | 'denied' | 'blocked';

export default function Permissions() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requestPermissionAndScan, scanning, scanPhase, foundCount, markScanned } = useLibrary();
  const [stage, setStage] = useState<Stage>('explain');

  const start = async () => {
    setStage('scanning');
    const result = await requestPermissionAndScan();
    if (result === 'granted') setStage('done');
    else setStage(result);
  };

  const skipToApp = () => {
    markScanned();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]} testID="permissions-screen">
      {stage === 'explain' && (
        <View style={styles.center}>
          <View style={styles.iconGlowWrap}>
            <View style={styles.glow} />
            <View style={styles.iconTile}>
              <Ionicons name="folder-open" size={40} color={colors.onBrandTint} />
            </View>
          </View>
          <Text style={styles.title}>Let tunAide AP find your audio</Text>
          <Text style={styles.body}>
            To build your audio library, tunAide AP needs access to audio files available on this device.
            {'\n\n'}Scanning is local — nothing is uploaded until you explicitly press Push.
          </Text>
          {Platform.OS === 'web' && (
            <View style={styles.webNote}>
              <Ionicons name="information-circle" size={16} color={colors.warning} />
              <Text style={styles.webNoteText}>
                {"Web preview can't access device storage — a sample library will be loaded so you can try every feature. Open the app on Android/iOS to scan real device audio."}
              </Text>
            </View>
          )}
          <PrimaryButton
            testID="allow-audio-access-button"
            label="Allow Audio Access"
            onPress={start}
            style={{ alignSelf: 'stretch', marginTop: spacing.xxl }}
          />
        </View>
      )}

      {stage === 'scanning' && (
        <View style={styles.center} testID="scan-progress-view">
          <Text style={styles.countBig} testID="scan-found-count">{foundCount}</Text>
          <Text style={styles.countLabel}>audio files found</Text>
          <View style={styles.phaseRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.phase}>{scanning ? (scanPhase || 'Building your audio library...') : 'Almost done'}</Text>
          </View>
          {!scanning && foundCount >= 0 && stage === 'scanning' && (
            <PrimaryButton
              testID="scan-continue-button"
              label="Go to Library"
              onPress={skipToApp}
              style={{ alignSelf: 'stretch', marginTop: spacing.xxl }}
            />
          )}
        </View>
      )}

      {stage === 'done' && (
        <View style={styles.center} testID="scan-complete-view">
          <View style={styles.iconGlowWrap}>
            <View style={[styles.glow, { backgroundColor: 'rgba(16,185,129,0.15)' }]} />
            <View style={[styles.iconTile, { borderColor: colors.success }]}>
              <Ionicons name="checkmark" size={40} color={colors.success} />
            </View>
          </View>
          <Text style={styles.countBig}>{foundCount.toLocaleString()}</Text>
          <Text style={styles.countLabel}>audio files found</Text>
          <Text style={[styles.body, { marginTop: spacing.lg }]}>
            Your library is organized and ready. Select any audio and push it to tunAide Transcribe.
          </Text>
          <PrimaryButton
            testID="go-to-library-button"
            label="Go to Library"
            onPress={skipToApp}
            style={{ alignSelf: 'stretch', marginTop: spacing.xxl }}
          />
        </View>
      )}

      {(stage === 'denied' || stage === 'blocked') && (
        <View style={styles.center} testID="permission-denied-view">
          <View style={styles.iconGlowWrap}>
            <View style={[styles.glow, { backgroundColor: 'rgba(220,20,60,0.12)' }]} />
            <View style={[styles.iconTile, { borderColor: colors.error }]}>
              <Ionicons name="lock-closed" size={36} color={colors.error} />
            </View>
          </View>
          <Text style={styles.title}>Audio access needed</Text>
          <Text style={styles.body}>
            {"Without audio access, tunAide AP can't build your library."}
            {stage === 'blocked'
              ? ' Permission was previously declined — enable it from your device settings.'
              : ' You can grant access to start scanning.'}
          </Text>
          {stage === 'blocked' ? (
            <PrimaryButton
              testID="open-settings-button"
              label="Open Settings"
              onPress={() => Linking.openSettings()}
              style={{ alignSelf: 'stretch', marginTop: spacing.xxl }}
            />
          ) : (
            <PrimaryButton
              testID="retry-permission-button"
              label="Allow Audio Access"
              onPress={start}
              style={{ alignSelf: 'stretch', marginTop: spacing.xxl }}
            />
          )}
          <GhostButton
            testID="continue-without-library-button"
            label="Continue without library"
            onPress={skipToApp}
            style={{ alignSelf: 'stretch', marginTop: spacing.md }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconGlowWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  glow: {
    position: 'absolute', width: 170, height: 170, borderRadius: 85,
    backgroundColor: colors.brandTint, opacity: 0.5,
  },
  iconTile: {
    width: 96, height: 96, borderRadius: radius.lg, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.brand,
  },
  title: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.xxl, textAlign: 'center', marginBottom: spacing.md },
  body: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.base, textAlign: 'center', lineHeight: 22 },
  webNote: {
    flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surface2,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginTop: spacing.xl,
  },
  webNoteText: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.sm, flex: 1, lineHeight: 18 },
  countBig: { color: colors.onSurface, fontFamily: font.bold, fontSize: 56 },
  countLabel: { color: colors.onSurface2, fontFamily: font.medium, fontSize: type.lg, marginTop: spacing.xs },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  phase: { color: colors.onSurface3, fontFamily: font.medium, fontSize: type.base },
});
