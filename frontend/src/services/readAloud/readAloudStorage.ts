import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export interface ReadAloudDocument {
  id: string;
  name: string;
  text: string;
  readingStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  lastReadLineIndex: number;
  lastUpdated: number;
}

const STORAGE_KEY = '@read_aloud_documents';

export const getDocuments = async (): Promise<ReadAloudDocument[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json);
  } catch (error) {
    console.error('Error loading documents', error);
    return [];
  }
};

export const getDocument = async (id: string): Promise<ReadAloudDocument | null> => {
  const docs = await getDocuments();
  return docs.find((d) => d.id === id) || null;
};

export const saveDocument = async (doc: ReadAloudDocument): Promise<void> => {
  const docs = await getDocuments();
  const index = docs.findIndex((d) => d.id === doc.id);
  if (index >= 0) {
    docs[index] = { ...doc, lastUpdated: Date.now() };
  } else {
    docs.push({ ...doc, lastUpdated: Date.now() });
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
};

export const deleteDocument = async (id: string): Promise<void> => {
  const docs = await getDocuments();
  const newDocs = docs.filter((d) => d.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
};

export const createDocument = async (name: string, text: string): Promise<string> => {
  const id = Crypto.randomUUID();
  await saveDocument({
    id,
    name,
    text,
    readingStatus: 'NOT_STARTED',
    lastReadLineIndex: 0,
    lastUpdated: Date.now(),
  });
  return id;
};

export const updateDocumentText = async (id: string, text: string): Promise<void> => {
  const doc = await getDocument(id);
  if (doc) {
    await saveDocument({
      ...doc,
      text,
      lastReadLineIndex: 0,
      readingStatus: 'NOT_STARTED'
    });
  }
}

export const updateDocumentStatus = async (id: string, index: number, isCompleted: boolean): Promise<void> => {
  const doc = await getDocument(id);
  if (doc) {
    await saveDocument({
      ...doc,
      lastReadLineIndex: index,
      readingStatus: isCompleted ? 'COMPLETED' : 'IN_PROGRESS'
    });
  }
}
