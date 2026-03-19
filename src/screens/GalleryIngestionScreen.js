import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImagesSigned } from '../utils/cloudinary';
import { apiRequest } from '../utils/api';
import { getSessionToken, getSessionEmail } from '../utils/storage';

const MAX_IMAGES = 100;

export default function GalleryIngestionScreen({ navigation }) {
  const [uris, setUris] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ total: 0, done: 0 });

  async function pickImages() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'We need access to your gallery.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - uris.length,
      quality: 0.7,
    });

    if (!res.canceled) {
      const newUris = res.assets.map(a => a.uri);
      setUris(prev => [...prev, ...newUris].slice(0, MAX_IMAGES));
    }
  }

  async function onUpload() {
    if (uris.length === 0) return;
    setSubmitting(true);
    setProgress({ total: uris.length, done: 0 });

    try {
      const token = await getSessionToken();
      const email = await getSessionEmail();
      
      // 1. Upload to Cloudinary
      // NOTE: We need the local path for Gemini on the backend if we don't handle URLs.
      // But since we updated ai_service.py to handle URLs, we can use the Cloudinary URLs.
      const uploadedUrls = await uploadImagesSigned({
        uris,
        folder: `user_gallery/${email}`,
        onItemComplete: ({ index, total }) => {
          setProgress({ total, done: index + 1 });
        }
      });

      // 2. Send to backend for ingestion (embeddings & face check)
      // Since the backend needs 'path' for the ai_service to work locally, 
      // but we are on mobile, we pass the URLs and let the backend download them.
      const imagePayload = uploadedUrls.map(url => ({ url, path: url }));
      
      await apiRequest('/api/ai/ingest', {
        method: 'POST',
        token,
        body: { images: imagePayload }
      });

      Alert.alert('Success', 'Gallery processed successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Import Gallery</Text>
        <Text style={styles.subtitle}>Select up to {MAX_IMAGES} images to index with AI ({uris.length}/{MAX_IMAGES})</Text>
      </View>

      <FlatList
        data={uris}
        keyExtractor={(item, index) => String(index)}
        numColumns={4}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={styles.thumb} />
        )}
        ListEmptyComponent={
          <Pressable onPress={pickImages} style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Tap to select images</Text>
          </Pressable>
        }
        contentContainerStyle={styles.list}
      />

      <View style={styles.footer}>
        <Pressable onPress={pickImages} disabled={submitting} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Pick More</Text>
        </Pressable>
        <Pressable 
          onPress={onUpload} 
          disabled={submitting || uris.length === 0} 
          style={[styles.primaryButton, (submitting || uris.length === 0) && { opacity: 0.6 }]}
        >
          {submitting ? (
            <ActivityIndicator color="#06210f" />
          ) : (
            <Text style={styles.primaryButtonText}>Process with AI</Text>
          )}
        </Pressable>
      </View>
      
      {submitting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.overlayText}>Uploading & Indexing... {progress.done}/{progress.total}</Text>
          <Text style={styles.subOverlayText}>This may take a minute for many images.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  header: { padding: 20, paddingTop: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  list: { padding: 10 },
  thumb: { width: '23%', aspectRatio: 1, margin: '1%', borderRadius: 8 },
  emptyWrap: { flex: 1, height: 200, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#fff', borderRadius: 10 },
  emptyText: { color: '#fff' },
  footer: { padding: 20, flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 2, backgroundColor: '#22c55e', padding: 15, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#06210f', fontWeight: '700' },
  secondaryButton: { flex: 1, backgroundColor: '#1f2a44', padding: 15, borderRadius: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#fff' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,18,32,0.9)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  overlayText: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 20 },
  subOverlayText: { color: 'rgba(255,255,255,0.6)', marginTop: 10, textAlign: 'center' },
});
