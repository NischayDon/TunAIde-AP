import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, type, radius } from '@/src/theme';
import { getDocuments, ReadAloudDocument } from '@/src/services/readAloud/readAloudStorage';

export default function ReadAloudHome() {
  const [documents, setDocuments] = useState<ReadAloudDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadDocs = async () => {
    setLoading(true);
    const docs = await getDocuments();
    setDocuments(docs.sort((a, b) => b.lastUpdated - a.lastUpdated));
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadDocs();
    }, [])
  );

  const handleDocPress = (item: ReadAloudDocument) => {
    if (item.readingStatus === 'NOT_STARTED') {
      router.push(`/read-aloud/reader?id=${item.id}`);
    } else {
      Alert.alert(
        item.name,
        'What would you like to do?',
        [
          { 
            text: 'Resume from where you left off', 
            onPress: () => router.push(`/read-aloud/reader?id=${item.id}`) 
          },
          { 
            text: 'Start from beginning', 
            onPress: () => router.push(`/read-aloud/reader?id=${item.id}&reset=true`)
          },
          { 
            text: 'Edit Text', 
            onPress: () => router.push(`/read-aloud/editor?id=${item.id}`) 
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const renderItem = ({ item }: { item: ReadAloudDocument }) => {
    const isCompleted = item.readingStatus === 'COMPLETED';
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => handleDocPress(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity onPress={() => router.push(`/read-aloud/editor?id=${item.id}`)}>
            <Ionicons name="pencil" size={20} color={colors.brand} />
          </TouchableOpacity>
        </View>
        <Text style={styles.preview} numberOfLines={2}>{item.text}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.status}>
            {item.readingStatus === 'NOT_STARTED' ? 'Not Started' : isCompleted ? 'Completed' : 'In Progress'}
          </Text>
          <Text style={styles.date}>
            {new Date(item.lastUpdated).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Read Aloud</Text>
      </View>
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={64} color={colors.surface3} />
              <Text style={styles.emptyText}>No documents saved.</Text>
              <Text style={styles.emptySubtext}>Add a document to start reading.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push('/read-aloud/editor')}
      >
        <Ionicons name="add" size={32} color={colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface2,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    fontSize: type.xxl,
    fontFamily: font.bold,
    color: colors.onSurface,
  },
  list: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: type.lg,
    fontFamily: font.semibold,
    color: colors.onSurface,
    flex: 1,
    marginRight: spacing.sm,
  },
  preview: {
    fontSize: type.base,
    fontFamily: font.regular,
    color: colors.onSurface2,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: {
    fontSize: type.sm,
    fontFamily: font.medium,
    color: colors.brand,
    backgroundColor: colors.brandTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  date: {
    fontSize: type.sm,
    fontFamily: font.regular,
    color: colors.onSurface3,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xxl,
    right: spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: type.lg,
    fontFamily: font.semibold,
    color: colors.onSurface2,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: type.base,
    fontFamily: font.regular,
    color: colors.onSurface3,
    marginTop: spacing.xs,
  },
});
