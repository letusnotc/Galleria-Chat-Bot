import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { uploadImagesSigned } from '../utils/cloudinary';
import { apiRequest } from '../utils/api';
import { createSession } from '../utils/storage';

const FACE_PHOTO_COUNT = 10;

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [pickedUris, setPickedUris] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState({ total: 0, done: 0 });

  const remaining = FACE_PHOTO_COUNT - pickedUris.length;

  const canPickMore = remaining > 0 && !submitting;
  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 6 &&
      pickedUris.length === FACE_PHOTO_COUNT &&
      !submitting
    );
  }, [name, email, password, pickedUris.length, submitting]);

  async function ensurePermission() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow photo library access to select images.'
      );
      return false;
    }
    return true;
  }

  function addUris(newUris) {
    setPickedUris((prev) => {
      const set = new Set(prev);
      for (const u of newUris) {
        if (set.size >= FACE_PHOTO_COUNT) break;
        if (u) set.add(u);
      }
      return Array.from(set);
    });
  }

  async function pickImages() {
    const ok = await ensurePermission();
    if (!ok) return;

    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });

      if (res.canceled) return;
      const uris = (res.assets ?? []).map((a) => a.uri).filter(Boolean);
      if (!uris.length) return;

      addUris(uris);
    } catch (e) {
      Alert.alert('Image picker error', e?.message ?? 'Unable to open gallery.');
    }
  }

  function removeUri(uri) {
    setPickedUris((prev) => prev.filter((u) => u !== uri));
  }

  async function onSignup() {
    const cleanName = name.trim();
    const emailKey = email.trim().toLowerCase();

    if (!cleanName || !emailKey || !password) {
      Alert.alert('Missing info', 'Please fill all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password should be at least 6 characters.');
      return;
    }
    if (pickedUris.length !== FACE_PHOTO_COUNT) {
      Alert.alert(
        'Select face photos',
        `Please select exactly ${FACE_PHOTO_COUNT} clear photos of your face.`
      );
      return;
    }

    setSubmitting(true);
    setUploadState({ total: FACE_PHOTO_COUNT, done: 0 });
    try {
      // 1. Upload face photos to Cloudinary
      const urls = await uploadImagesSigned({
        uris: pickedUris,
        folder: `users/${emailKey}/faces`,
        onItemComplete: ({ index, total }) => {
          setUploadState({ total, done: index + 1 });
        },
      });

      // 2. Call signup with facePhotos
      const data = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: {
          name: cleanName,
          email: emailKey,
          password,
          facePhotos: urls,
        },
      });

      const token = data?.token;
      const user = data?.user;
      if (!token || !user?.email) {
        throw new Error('Invalid server response');
      }

      await createSession({ token, email: user.email });
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e) {
      const msg =
        e?.status === 409
          ? 'Email already used. Please login instead.'
          : e?.status
            ? `${e.message}`
            : e?.message ?? 'Please try again.';
      Alert.alert('Signup failed', msg);
      if (e?.status === 409) navigation.navigate('Login');
    } finally {
      setSubmitting(false);
      setUploadState({ total: 0, done: 0 });
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={pickedUris}
        keyExtractor={(item) => item}
        numColumns={3}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              We need {FACE_PHOTO_COUNT} clear photos of your face to identify you in your gallery.
            </Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              style={styles.input}
              editable={!submitting}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              editable={!submitting}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              style={styles.input}
              editable={!submitting}
            />

            <View style={styles.actions}>
              <Pressable
                onPress={pickImages}
                disabled={!canPickMore}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (!canPickMore || pressed) && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  Pick Face Photos ({pickedUris.length}/{FACE_PHOTO_COUNT})
                </Text>
              </Pressable>

              <Pressable
                onPress={onSignup}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!canSubmit || pressed) && { opacity: 0.7 },
                ]}
              >
                {submitting ? (
                  <View style={styles.inline}>
                    <ActivityIndicator color="#06210f" />
                    <Text style={styles.primaryButtonText}>
                      {'  '}
                      Processing {uploadState.done}/{uploadState.total || FACE_PHOTO_COUNT}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>Sign up & Secure</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.row}>
              <Text style={styles.muted}>Already have an account?</Text>
              <Pressable onPress={() => navigation.navigate('Login')} disabled={submitting}>
                <Text style={styles.link}> Login</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Selected face photos</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() =>
              Alert.alert('Remove image?', 'This will remove it from selection.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeUri(item) },
              ])
            }
            style={styles.thumbWrap}
            disabled={submitting}
          >
            <Image source={{ uri: item }} style={styles.thumb} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No photos selected yet. Tap “Pick Face Photos” above.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={pickedUris.length ? styles.column : undefined}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    marginBottom: 16,
  },
  label: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    backgroundColor: '#111b2e',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  actions: {
    marginTop: 14,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#06210f',
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#1f2a44',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  muted: {
    color: 'rgba(255,255,255,0.7)',
  },
  link: {
    color: '#93c5fd',
    fontWeight: '600',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 10,
  },
  column: {
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  thumbWrap: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#111b2e',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  empty: {
    backgroundColor: '#111b2e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
});
