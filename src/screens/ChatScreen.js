import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image as RNImage,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { apiRequest } from '../utils/api';
import { getSessionToken } from '../utils/storage';

export default function ChatScreen() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: 'Hello! Ask me to find images. E.g., \"me at the beach\" or \"mountain landscape\".' },
  ]);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef();

  const onSend = async () => {
    if (!query.trim()) return;

    const userMsg = { id: Date.now(), type: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const token = await getSessionToken();
      const data = await apiRequest('/api/ai/query', { 
        method: 'POST',
        token,
        body: { query: userMsg.text }
      });
      
      const botMsg = {
        id: Date.now() + 1,
        type: 'bot',
        text: data.isPersonalQuery 
          ? `I found these images that look like you in: ${userMsg.text}`
          : `Here are some images matching: ${userMsg.text}`,
        images: data.results,
        intent: data.intent
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [...prev, { id: Date.now() + 1, type: 'bot', text: 'Sorry, I had trouble processing that.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Ask something... (e.g. 'me eating')"
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
          />
          <Pressable onPress={onSend} disabled={loading} style={styles.sendButton}>
            {loading ? <ActivityIndicator color="#06210f" /> : <Text style={styles.sendText}>Send</Text>}
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.message, item.type === 'user' ? styles.userMessage : styles.botMessage]}>
              <Text style={styles.messageText}>{item.text}</Text>
              {item.intent && item.type === 'bot' && (
                <Text style={styles.intentLabel}>Intent: {item.intent}</Text>
              )}
              {item.images && item.images.length > 0 && (
                <View style={styles.imageGrid}>
                  {item.images.map((img, i) => (
                    <RNImage key={i} source={{ uri: img.url }} style={styles.resultImage} />
                  ))}
                </View>
              )}
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  message: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#1e293b',
    borderBottomRightRadius: 4,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 20,
  },
  intentLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#10b981',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: {
    color: '#064e3b',
    fontWeight: '700',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  resultImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
});
