import React, { useCallback, useEffect, useState } from 'react';
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

import { clearSession, getCurrentUser, getSessionToken } from '../utils/storage';
import { apiRequest } from '../utils/api';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [aiImages, setAiImages] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = await getCurrentUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }
      setUser(u);

      // Fetch AI-indexed images
      const token = await getSessionToken();
      const imgData = await apiRequest('/api/ai/images', { token });
      if (imgData?.images) {
        setAiImages(imgData.images.map(img => img.url));
      }
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Failed to load user data.');
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  async function onLogout() {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Combine user.images and aiImages (removing duplicates)
  const allImages = Array.from(new Set([...(user?.images || []), ...aiImages]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcome}>Hello, {user?.name ?? 'there'}.</Text>
          <Text style={styles.subtitle}>Your AI-powered gallery</Text>
        </View>

        <View style={styles.headerActions}>
            <Pressable
            onPress={() => navigation.navigate('Chat')}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
            >
            <Text style={styles.actionButtonText}>Chat</Text>
            </Pressable>

            <Pressable
            onPress={() => navigation.navigate('GalleryIngestion')}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
            >
            <Text style={styles.actionButtonText}>Import</Text>
            </Pressable>

            <Pressable
            onPress={() =>
                Alert.alert('Logout', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: onLogout },
                ])
            }
            style={({ pressed }) => [styles.logout, pressed && { opacity: 0.7 }]}
            >
            <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
        </View>
      </View>

      <FlatList
        data={allImages}
        keyExtractor={(item, idx) => `${item}_${idx}`}
        numColumns={3}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.thumbWrap}>
            <Image source={{ uri: item }} style={styles.thumb} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No images found</Text>
            <Text style={styles.emptyText}>
              Tap "Import" above to index your gallery with AI.
            </Text>
          </View>
        }
        refreshing={loading}
        onRefresh={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  welcome: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontSize: 12,
  },
  actionButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionButtonText: {
    color: '#06210f',
    fontWeight: '700',
    fontSize: 12,
  },
  logout: {
    backgroundColor: '#1f2a44',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
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
  emptyTitle: {
    color: '#fff',
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
  },
});
