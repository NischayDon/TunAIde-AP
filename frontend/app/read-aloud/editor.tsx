import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, Text, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/src/api/client';
import { colors, spacing, font, type, radius } from '@/src/theme';
import { getDocument, createDocument, updateDocumentText } from '@/src/services/readAloud/readAloudStorage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function ReadAloudEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      getDocument(id).then(doc => {
        if (doc) {
          setName(doc.name);
          setText(doc.text);
        }
      });
    }
  }, [id]);

  const handleSave = async () => {
    if (!text.trim()) {
      Alert.alert('Error', 'Please enter some text to read.');
      return;
    }
    const finalName = name.trim() || 'Untitled Document';
    
    if (id) {
      await updateDocumentText(id, text);
      router.back();
    } else {
      const newId = await createDocument(finalName, text);
      router.replace(`/read-aloud/reader?id=${newId}`);
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const isPdf = asset.mimeType === 'application/pdf' || asset.name.endsWith('.pdf');
      
      setLoading(true);
      
      if (!isPdf) {
        // Simple text file
        const fileContent = await FileSystem.readAsStringAsync(asset.uri);
        setText(fileContent);
        if (!name) setName(asset.name.replace('.txt', ''));
      } else {
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/pdf',
        } as any);

        const res = await fetch(`${API_URL}/extract-pdf`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error('Failed to extract text from PDF');
        }

        const data = await res.json();
        setText(data.text);
        if (!name) setName(asset.name.replace('.pdf', ''));
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to import file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{id ? 'Edit Text' : 'New Document'}</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content}>
          <TextInput
            style={styles.nameInput}
            placeholder="Document Title"
            placeholderTextColor={colors.onSurface3}
            value={name}
            onChangeText={setName}
          />
          
          <TouchableOpacity style={styles.importButton} onPress={handleImport} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <>
                <Ionicons name="document-attach" size={20} color={colors.brand} />
                <Text style={styles.importText}>Import TXT or PDF</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            placeholder="Paste or type text here..."
            placeholderTextColor={colors.onSurface3}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: type.lg,
    fontFamily: font.semibold,
    color: colors.onSurface,
  },
  saveButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  saveText: {
    color: colors.white,
    fontFamily: font.medium,
    fontSize: type.base,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  nameInput: {
    fontSize: type.xl,
    fontFamily: font.semibold,
    color: colors.onSurface,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginBottom: spacing.md,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.brandTint,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  importText: {
    color: colors.brand,
    fontFamily: font.medium,
    marginLeft: spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 400,
    fontSize: type.lg,
    fontFamily: font.regular,
    color: colors.onSurface,
    lineHeight: 24,
  },
});
