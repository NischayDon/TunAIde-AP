import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLibrary } from '@/src/context/LibraryContext';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { storage } from '@/src/utils/storage';

export default function Index() {
  const { libLoaded, hasScanned } = useLibrary();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    storage.getItem<boolean>('tunaide.onboarded', false).then((v) => setOnboarded(v === true));
  }, []);

  if (onboarded === null || !libLoaded) {
    return (
      <View style={styles.splash} testID="splash-screen">
        <View style={styles.logo}>
          <Ionicons name="pulse" size={36} color={colors.white} />
        </View>
        <Text style={styles.name}>tunAide <Text style={{ color: colors.brand2 }}>AP</Text></Text>
        <Text style={styles.sub}>Audio Pusher</Text>
        <Text style={styles.tag}>Smart Audio. Organized.</Text>
      </View>
    );
  }

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!hasScanned) return <Redirect href="/permissions" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 84, height: 84, borderRadius: radius.lg, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
  },
  name: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.hero },
  sub: { color: colors.onSurface2, fontFamily: font.medium, fontSize: type.lg, marginTop: spacing.xs },
  tag: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.base, marginTop: spacing.xl },
});
