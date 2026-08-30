import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Dimensions, LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, type, radius } from '@/src/theme';
import { getDocument, updateDocumentStatus, ReadAloudDocument } from '@/src/services/readAloud/readAloudStorage';
import { segmentText, TextSegment } from '@/src/utils/TextSegmenter';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PlayState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'COMPLETED';

export default function ReadAloudReader() {
  const { id, reset } = useLocalSearchParams<{ id: string, reset?: string }>();
  const router = useRouter();
  
  const [document, setDocument] = useState<ReadAloudDocument | null>(null);
  const [segments, setSegments] = useState<TextSegment[]>([]);
  
  const [playState, setPlayState] = useState<PlayState>('IDLE');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  
  const [settings, setSettings] = useState({
    autoScroll: true,
    voice: '',
    language: '',
    rate: 1.0,
    pitch: 1.0
  });
  
  const scrollViewRef = useRef<ScrollView>(null);
  const segmentLayouts = useRef<{ [key: number]: number }>({});
  
  const playStateRef = useRef(playState);
  const currentIndexRef = useRef(currentIndex);
  const currentWordIndexRef = useRef(currentWordIndex);
  
  useEffect(() => { playStateRef.current = playState; }, [playState]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { currentWordIndexRef.current = currentWordIndex; }, [currentWordIndex]);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('@read_aloud_settings');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSettings();
    if (id) {
      getDocument(id).then(doc => {
        if (doc) {
          setDocument(doc);
          const segs = segmentText(doc.text);
          setSegments(segs);
          let startIdx = Math.max(0, Math.min(doc.lastReadLineIndex, segs.length - 1));
          if (reset === "true") startIdx = 0;
          setCurrentIndex(startIdx);
          setCurrentWordIndex(0);
        }
      });
    }
    
    return () => {
      updateDocumentStatus(id as string, currentIndexRef.current, false);
      Speech.stop();
    };
  }, [id, reset]);

  // Handle auto-scroll whenever current segment changes
  useEffect(() => {
    if (id && currentIndex >= 0) {
      updateDocumentStatus(id as string, currentIndex, false);
    }
    if (settings.autoScroll && scrollViewRef.current && segmentLayouts.current[currentIndex] !== undefined) {
      const yPos = segmentLayouts.current[currentIndex];
      // Scroll to position, offset by a little to not hug the top perfectly
      scrollViewRef.current.scrollTo({ y: Math.max(0, yPos - 60), animated: true });
    }
  }, [currentIndex, settings.autoScroll, id]);

  const speakSegment = async (segIndex: number, wordIndex: number = 0) => {
    if (segIndex >= segments.length) {
      setPlayState('COMPLETED');
      return;
    }
    
    const segment = segments[segIndex];
    if (segment.isBlank) {
      const nextIdx = segIndex + 1;
      setCurrentIndex(nextIdx);
      setCurrentWordIndex(0);
      if (playStateRef.current === 'PLAYING') {
        speakSegment(nextIdx, 0);
      }
      return;
    }

    const words = segment.text.split(" ");
    const textToSpeak = wordIndex > 0 ? words.slice(wordIndex).join(" ") : segment.text;
    
    const options: Speech.SpeechOptions = {
      rate: settings.rate,
      pitch: settings.pitch,
      onDone: () => {
        // Only progress if we are still considered "PLAYING"
        if (playStateRef.current === 'PLAYING') {
          const nextIndex = currentIndexRef.current + 1;
          if (nextIndex < segments.length) {
            setCurrentIndex(nextIndex);
            setCurrentWordIndex(0);
            speakSegment(nextIndex, 0);
          } else {
            setPlayState('COMPLETED');
            updateDocumentStatus(id as string, currentIndexRef.current, true);
          }
        }
      },
      onError: () => {
        setPlayState('PAUSED');
        Alert.alert('Error', 'Failed to read segment.');
      }
    };
    
    if (settings.voice) {
      options.voice = settings.voice;
    } else if (settings.language) {
      options.language = settings.language;
    }
    
    Speech.speak(textToSpeak, options);
  };

  const handlePlay = async () => {
    if (playState === 'PLAYING') return;
    setPlayState('PLAYING');
    await Speech.stop(); // Stop any active speech before restarting
    
    // If it was completed, restart from beginning
    if (playState === 'COMPLETED') {
      setCurrentIndex(0);
      setCurrentWordIndex(0);
      speakSegment(0, 0);
    } else {
      speakSegment(currentIndex, currentWordIndex);
    }
  };

  const handlePause = async () => {
    if (playState !== 'PLAYING') return;
    setPlayState('PAUSED');
    await Speech.stop();
  };

  const togglePlayPause = () => {
    if (playState === 'PLAYING') {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const skipTo = async (segIndex: number, wordIndex: number = 0, forcePlay: boolean = false) => {
    if (segIndex >= 0 && segIndex < segments.length) {
      setCurrentIndex(segIndex);
      setCurrentWordIndex(wordIndex);
      
      const shouldPlay = playState === 'PLAYING' || forcePlay;
      await Speech.stop();
      
      if (shouldPlay) {
        setPlayState('PLAYING');
        speakSegment(segIndex, wordIndex);
      }
    }
  };

  const onSegmentLayout = (index: number, event: LayoutChangeEvent) => {
    segmentLayouts.current[index] = event.nativeEvent.layout.y;
  };

  if (!document) {
    return <SafeAreaView style={styles.container} />
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{document.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push(`/read-aloud/editor?id=${document.id}`)} style={styles.iconButton}>
            <Ionicons name="pencil" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/read-aloud/settings')} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView ref={scrollViewRef} style={styles.content} contentContainerStyle={styles.contentInner}>
        {segments.map((segment, index) => {
          if (segment.isBlank) return <Text key={index} style={styles.blankLine} onLayout={(e) => onSegmentLayout(index, e)}> </Text>;
          
          const isActive = index === currentIndex;
          return (
            <TouchableOpacity 
              key={index} 
              onLayout={(e) => onSegmentLayout(index, e)}
              onPress={() => skipTo(index, 0)}
              style={[styles.segmentContainer, isActive && styles.activeSegmentContainer]}
            >
              <Text style={[styles.segmentText, isActive && styles.activeSegmentText]}>
                {segment.text.split(' ').map((word, wIdx) => {
                   const isWordActive = isActive && wIdx === currentWordIndex;
                   return (
                     <Text 
                       key={wIdx} 
                       onPress={() => skipTo(index, wIdx, true)}
                       style={isWordActive ? styles.activeWordText : undefined}
                     >{word} </Text>
                   );
                })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => skipTo(currentIndex - 1, 0)} style={styles.controlButton}>
          <Ionicons name="play-skip-back" size={28} color={colors.onSurface} />
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
          <Ionicons name={playState === "PLAYING" ? "pause" : playState === "COMPLETED" ? "refresh" : "play"} size={36} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => skipTo(currentIndex + 1, 0)} style={styles.controlButton}>
          <Ionicons name="play-skip-forward" size={28} color={colors.onSurface} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconButton: {
    padding: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerTitle: {
    fontSize: type.lg,
    fontFamily: font.semibold,
    color: colors.onSurface,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  segmentContainer: {
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  activeSegmentContainer: {
    backgroundColor: colors.brandTint,
  },
  segmentText: {
    fontSize: type.xl,
    fontFamily: font.regular,
    color: colors.onSurface2,
    lineHeight: 32,
  },
  activeSegmentText: {
    color: colors.brand,
    fontFamily: font.semibold,
  },
  activeWordText: {
    backgroundColor: colors.brand,
    color: colors.white,
    overflow: 'hidden',
    borderRadius: 4,
  },
  blankLine: {
    height: spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  controlButton: {
    padding: spacing.md,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
  },
});
