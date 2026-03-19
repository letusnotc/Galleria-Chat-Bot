import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { apiRequest } from '../utils/api';
import { createSession } from '../utils/storage';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !submitting;
  }, [email, password, submitting]);

  async function onLogin() {
    const emailKey = email.trim().toLowerCase();
    if (!emailKey || !password) {
      Alert.alert('Missing info', 'Please enter email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email: emailKey, password },
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
        e?.status === 401
          ? 'Email or password is incorrect.'
          : e?.status
            ? `${e.message}`
            : e?.message ?? 'Please try again.';
      Alert.alert('Login failed', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Login to view your gallery</Text>

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
          placeholder="••••••••"
          secureTextEntry
          style={styles.input}
          editable={!submitting}
        />

        <Pressable
          onPress={onLogin}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primaryButton,
            (!canSubmit || pressed) && { opacity: 0.7 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Login</Text>
          )}
        </Pressable>

        <View style={styles.row}>
          <Text style={styles.muted}>New here?</Text>
          <Pressable onPress={() => navigation.navigate('Signup')} disabled={submitting}>
            <Text style={styles.link}> Create an account</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#111b2e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: '#0b1220',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
  },
  muted: {
    color: 'rgba(255,255,255,0.7)',
  },
  link: {
    color: '#93c5fd',
    fontWeight: '600',
  },
});

