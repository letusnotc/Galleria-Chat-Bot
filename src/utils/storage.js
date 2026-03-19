import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'session_v2'; // { token, email }

async function getJson(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function setJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function createSession({ token, email }) {
  await setJson(SESSION_KEY, { token, email: String(email || '').toLowerCase() });
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getSessionEmail() {
  const session = await getJson(SESSION_KEY, null);
  return session?.email ?? null;
}

export async function getSessionToken() {
  const session = await getJson(SESSION_KEY, null);
  return session?.token ?? null;
}

export async function getCurrentUser() {
  const { apiRequest } = await import('./api');
  const token = await getSessionToken();
  if (!token) return null;
  const data = await apiRequest('/api/auth/me', { token });
  return data?.user ?? null;
}

