import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, Text,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, type, radius } from '@/src/theme';
import { getDocument, createDocument, updateDocumentText } from '@/src/services/readAloud/readAloudStorage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';
import JSZip from 'jszip';

// ---------------------------------------------------------------------------
// Hidden WebView HTML — loads pdf.js from CDN *once* to parse PDFs locally.
// NO document data ever leaves the device; the CDN only serves the JS library.
// ---------------------------------------------------------------------------
const PDF_EXTRACTOR_HTML = `<!DOCTYPE html><html><head>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>
</head><body><script>
pdfjsLib.GlobalWorkerOptions.workerSrc=
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function onMsg(e){try{var d=JSON.parse(e.data);
  if(d.action==='extract')doPdf(d.base64);}catch(x){}}
document.addEventListener('message',onMsg);
window.addEventListener('message',onMsg);

async function doPdf(b64){try{
  var raw=atob(b64),u8=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)u8[i]=raw.charCodeAt(i);
  var pdf=await pdfjsLib.getDocument({data:u8}).promise;
  var t='';
  for(var p=1;p<=pdf.numPages;p++){
    var pg=await pdf.getPage(p);
    var tc=await pg.getTextContent();
    var prev=null;
    tc.items.forEach(function(item){
      if(prev && Math.abs(item.transform[5]-prev.transform[5])>2) t+='\\n';
      else if(prev) t+=' ';
      t+=item.str; prev=item;
    });
    t+='\\n\\n';
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({ok:true,text:t}));
}catch(e){
  window.ReactNativeWebView.postMessage(JSON.stringify({ok:false,err:e.message}));
}}

window.ReactNativeWebView.postMessage(JSON.stringify({ready:true}));
<\/script></body></html>`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ReadAloudEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  // PDF WebView refs
  const webViewRef = useRef<WebView>(null);
  const webViewReadyRef = useRef(false);
  const pdfResolveRef = useRef<((t: string) => void) | null>(null);
  const pendingBase64Ref = useRef<string | null>(null);

  useEffect(() => {
    if (id) {
      getDocument(id).then((doc) => {
        if (doc) { setName(doc.name); setText(doc.text); }
      });
    }
  }, [id]);

  // ---- save -----------------------------------------------------------------
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

  // ---- WebView message handler (PDF) ----------------------------------------
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.ready) {
        webViewReadyRef.current = true;
        if (pendingBase64Ref.current) {
          webViewRef.current?.postMessage(
            JSON.stringify({ action: 'extract', base64: pendingBase64Ref.current }),
          );
          pendingBase64Ref.current = null;
        }
        return;
      }
      if (pdfResolveRef.current) {
        pdfResolveRef.current(data.ok ? data.text : '');
        pdfResolveRef.current = null;
      }
    } catch { /* ignore bad messages */ }
  }, []);

  // ---- TXT ------------------------------------------------------------------
  const handleImportTxt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/plain',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setLoading(true);
      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri);
      setText(content);
      if (!name) setName(asset.name.replace(/\.txt$/i, ''));
    } catch {
      Alert.alert('Error', 'Failed to import text file.');
    } finally {
      setLoading(false);
    }
  };

  // ---- PDF (via hidden WebView + pdf.js) ------------------------------------
  const handleImportPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setLoading(true);
      const asset = result.assets[0];

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const extracted: string = await new Promise((resolve) => {
        pdfResolveRef.current = resolve;
        const timer = setTimeout(() => {
          if (pdfResolveRef.current) { pdfResolveRef.current(''); pdfResolveRef.current = null; }
        }, 30000);

        const send = () =>
          webViewRef.current?.postMessage(JSON.stringify({ action: 'extract', base64 }));

        if (webViewReadyRef.current) {
          send();
        } else {
          pendingBase64Ref.current = base64;
        }
      });

      if (extracted.trim()) {
        setText(extracted);
        if (!name) setName(asset.name.replace(/\.pdf$/i, ''));
      } else {
        Alert.alert('No Text Found', 'Could not extract text from this PDF. It may be a scanned image-only PDF.');
      }
    } catch {
      Alert.alert('Error', 'Failed to extract text from PDF.');
    } finally {
      setLoading(false);
    }
  };

  // ---- DOCX (via jszip — fully offline, pure JS) ---------------------------
  const handleImportDocx = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const isOldDoc =
        asset.name.toLowerCase().endsWith('.doc') &&
        !asset.name.toLowerCase().endsWith('.docx');

      if (isOldDoc) {
        Alert.alert(
          'Unsupported Format',
          'Old .doc files are not supported. Please save as .docx using Microsoft Word or Google Docs and try again.',
        );
        return;
      }

      setLoading(true);

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const zip = await JSZip.loadAsync(base64, { base64: true });
      const docXml = await zip.file('word/document.xml')?.async('string');

      if (!docXml) {
        Alert.alert('Error', 'Invalid DOCX file — could not find document content.');
        return;
      }

      const extracted = docXml
        .replace(/<w:p\b[^>]*\/>/g, '\n')
        .replace(/<w:p\b[^>]*>/g, '\n')
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<w:br\/>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (extracted) {
        setText(extracted);
        if (!name) setName(asset.name.replace(/\.docx?$/i, ''));
      } else {
        Alert.alert('No Text Found', 'Could not extract any text from this document.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to import Word document.');
    } finally {
      setLoading(false);
    }
  };

  // ---- import menu ----------------------------------------------------------
  const showImportOptions = () => {
    Alert.alert('Import Document', 'Choose a file type', [
      { text: 'PDF File', onPress: handleImportPdf },
      { text: 'Word Document (.docx)', onPress: handleImportDocx },
      { text: 'Text File (.txt)', onPress: handleImportTxt },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ---- render ---------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      {/* Hidden WebView for local PDF parsing — always mounted so pdf.js
          is pre-loaded by the time the user picks a file. */}
      <WebView
        ref={webViewRef}
        style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }}
        source={{ html: PDF_EXTRACTOR_HTML }}
        onMessage={handleWebViewMessage}
        javaScriptEnabled
        originWhitelist={['*']}
      />

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

          <TouchableOpacity style={styles.importButton} onPress={showImportOptions} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <>
                <Ionicons name="document-text" size={20} color={colors.brand} />
                <Text style={styles.importText}>Import PDF, DOCX, or TXT</Text>
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

// ---------------------------------------------------------------------------
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
