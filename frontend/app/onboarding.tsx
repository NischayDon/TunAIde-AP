import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions, FlatList, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/src/components/common';
import { colors, font, radius, spacing, type } from '@/src/theme';
import { storage } from '@/src/utils/storage';

const { width } = Dimensions.get('window');

const HERO = 'https://images.unsplash.com/photo-1648878136576-5ac4e7d11111?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHxtaW5pbWFsJTIwZGFyayUyMHRlY2glMjBhYnN0cmFjdHxlbnwwfHx8cHVycGxlfDE3ODY4OTkyMTF8MA&ixlib=rb-4.1.0&q=85';

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; hero?: boolean }[] = [
  {
    icon: 'pulse', hero: true,
    title: 'Welcome to tunAide AP',
    body: 'Smart Audio. Organized. Push to Transcribe.\n\nFind every accessible audio file on your device and send it to tunAide Transcribe in seconds.',
  },
  {
    icon: 'scan',
    title: 'Find Everything',
    body: 'tunAide AP scans every audio file your device makes accessible — music, recordings, voice memos, downloads and more — and builds a smart local index.',
  },
  {
    icon: 'albums',
    title: 'Organize Your Way',
    body: 'Browse by category, artist, format, source or duration. Search everything instantly. Your files never move — the organization is virtual.',
  },
  {
    icon: 'cloud-upload',
    title: 'Push to Transcribe',
    body: 'Select one file or a hundred. One tap on Push sends them straight to tunAide Transcribe — no browser, no manual uploads.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const last = page === SLIDES.length - 1;

  const finish = async () => {
    await storage.setItem('tunaide.onboarded', true);
    router.replace('/permissions');
  };

  return (
    <View style={styles.container} testID="onboarding-screen">
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            {item.hero ? (
              <View style={styles.heroWrap}>
                <Image source={{ uri: HERO }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                <LinearGradient
                  colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.75)', '#FFFFFF']}
                  locations={[0, 0.6, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={[styles.logoBadge, { marginTop: insets.top + spacing.xxl }]}>
                  <Ionicons name="pulse" size={30} color={colors.white} />
                </View>
              </View>
            ) : (
              <View style={[styles.iconWrap, { marginTop: insets.top + 120 }]}>
                <View style={styles.iconGlow} />
                <View style={styles.iconTile}>
                  <Ionicons name={item.icon} size={44} color={colors.onBrandTint} />
                </View>
              </View>
            )}
            <View style={styles.textBlock}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <PrimaryButton
          testID="onboarding-next-button"
          label={last ? 'Get Started' : 'Next'}
          onPress={() => {
            if (last) finish();
            else listRef.current?.scrollToIndex({ index: page + 1, animated: true });
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  slide: { flex: 1 },
  heroWrap: { height: '52%', alignItems: 'center' },
  logoBadge: {
    width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconGlow: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: colors.brandTint, opacity: 0.55,
  },
  iconTile: {
    width: 104, height: 104, borderRadius: radius.lg, backgroundColor: colors.brandTint,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.brand,
  },
  textBlock: { paddingHorizontal: spacing.xl, marginTop: spacing.xxl },
  title: { color: colors.onSurface, fontFamily: font.bold, fontSize: type.hero, marginBottom: spacing.md },
  body: { color: colors.onSurface2, fontFamily: font.regular, fontSize: type.lg, lineHeight: 24 },
  footer: { paddingHorizontal: spacing.xl },
  dots: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface3 },
  dotActive: { backgroundColor: colors.brand, width: 22 },
});
