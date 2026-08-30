import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, type, radius } from '@/src/theme';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ReadAloudSettings() {
  const router = useRouter();
  
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>('');
  
  const [settings, setSettings] = useState({
    autoScroll: true,
    voice: '',
    language: '',
    rate: 1.0,
    pitch: 1.0
  });
  
  useEffect(() => {
    const init = async () => {
      try {
        const availableVoices = await Speech.getAvailableVoicesAsync();
        const sortedVoices = availableVoices.sort((a, b) => a.language.localeCompare(b.language));
        setVoices(sortedVoices);
        
        const uniqueLangs = Array.from(new Set(sortedVoices.map(v => v.language))).sort();
        setLanguages(uniqueLangs);
        
        const stored = await AsyncStorage.getItem('@read_aloud_settings');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings(parsed);
          if (parsed.language && uniqueLangs.includes(parsed.language)) {
            setSelectedLang(parsed.language);
          } else if (uniqueLangs.length > 0) {
            setSelectedLang(uniqueLangs[0]);
          }
        } else if (uniqueLangs.length > 0) {
          setSelectedLang(uniqueLangs[0]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);

  const saveSettings = async (newSettings: typeof settings) => {
    setSettings(newSettings);
    await AsyncStorage.setItem('@read_aloud_settings', JSON.stringify(newSettings));
  };

  const previewVoice = async (voiceIdentifier: string) => {
    const voice = voices.find(v => v.identifier === voiceIdentifier);
    if (voice) {
      Speech.stop();
      Speech.speak('This is a sample reading voice. 1 2 3.', {
        voice: voice.identifier,
        rate: settings.rate,
        pitch: settings.pitch
      });
    }
  };

  const toggleAutoScroll = () => {
    saveSettings({ ...settings, autoScroll: !settings.autoScroll });
  };

  const selectVoice = (voiceId: string) => {
    saveSettings({ ...settings, voice: voiceId });
  };

  const selectLanguage = (lang: string) => {
    setSelectedLang(lang);
    saveSettings({ ...settings, language: lang });
  };

  const filteredVoices = voices.filter(v => v.language === selectedLang);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PLAYBACK</Text>
          
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Auto-scroll</Text>
              <Text style={styles.settingSub}>Automatically follow current segment</Text>
            </View>
            <Switch
              value={settings.autoScroll}
              onValueChange={toggleAutoScroll}
              trackColor={{ false: colors.surface3, true: colors.brandTint }}
              thumbColor={settings.autoScroll ? colors.brand : colors.onSurface3}
            />
          </View>
          
          <View style={styles.settingCol}>
            <Text style={styles.settingLabel}>Speed</Text>
            <View style={styles.speedOptions}>
              {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map(speed => (
                <TouchableOpacity 
                  key={speed} 
                  style={[styles.speedButton, settings.rate === speed && styles.activeSpeedButton]}
                  onPress={() => saveSettings({ ...settings, rate: speed })}
                >
                  <Text style={[styles.speedButtonText, settings.rate === speed && styles.activeSpeedText]}>{speed}x</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LANGUAGE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll} contentContainerStyle={styles.langContainer}>
            {languages.map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.langChip, selectedLang === lang && styles.activeLangChip]}
                onPress={() => selectLanguage(lang)}
              >
                <Text style={[styles.langText, selectedLang === lang && styles.activeLangText]}>{lang}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VOICES</Text>
          
          {filteredVoices.map(voice => (
            <View key={voice.identifier} style={styles.voiceRow}>
              <TouchableOpacity 
                style={styles.voiceInfo}
                onPress={() => selectVoice(voice.identifier)}
              >
                <Text style={[
                  styles.voiceName,
                  settings.voice === voice.identifier && styles.activeVoiceName
                ]}>
                  {voice.name}
                </Text>
                <Text style={styles.voiceSub}>{voice.language} {voice.quality}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.previewButton}
                onPress={() => previewVoice(voice.identifier)}
              >
                <Ionicons name="play" size={20} color={colors.brand} />
              </TouchableOpacity>
            </View>
          ))}
          {filteredVoices.length === 0 && (
             <Text style={styles.emptyText}>No voices available for this language.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: type.lg,
    fontFamily: font.semibold,
    color: colors.onSurface,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  sectionTitle: {
    fontSize: type.sm,
    fontFamily: font.bold,
    color: colors.onSurface3,
    padding: spacing.md,
    paddingBottom: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  settingLabel: {
    fontSize: type.base,
    fontFamily: font.medium,
    color: colors.onSurface,
  },
  settingSub: {
    fontSize: type.sm,
    fontFamily: font.regular,
    color: colors.onSurface3,
    marginTop: 2,
  },
  settingCol: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  speedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  speedButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  activeSpeedButton: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brand,
  },
  speedButtonText: {
    fontSize: type.sm,
    fontFamily: font.medium,
    color: colors.onSurface,
  },
  activeSpeedText: {
    color: colors.brand,
  },
  langScroll: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  langContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  langChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  activeLangChip: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brand,
  },
  langText: {
    fontSize: type.sm,
    fontFamily: font.medium,
    color: colors.onSurface,
  },
  activeLangText: {
    color: colors.brand,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  voiceInfo: {
    flex: 1,
  },
  voiceName: {
    fontSize: type.base,
    fontFamily: font.medium,
    color: colors.onSurface,
  },
  activeVoiceName: {
    color: colors.brand,
    fontFamily: font.bold,
  },
  voiceSub: {
    fontSize: type.sm,
    fontFamily: font.regular,
    color: colors.onSurface3,
    marginTop: 2,
  },
  previewButton: {
    padding: spacing.sm,
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
  },
  emptyText: {
    padding: spacing.md,
    color: colors.onSurface3,
    fontSize: type.sm,
    fontFamily: font.regular,
    textAlign: 'center',
  }
});
