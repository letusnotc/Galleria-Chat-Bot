import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import GalleryIngestionScreen from './src/screens/GalleryIngestionScreen';
import { getSessionToken } from './src/utils/storage';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRouteName, setInitialRouteName] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getSessionToken();
        if (!mounted) return;
        setInitialRouteName(token ? 'Home' : 'Login');
      } catch (e) {
        setInitialRouteName('Login');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!initialRouteName) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRouteName}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign Up' }} />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Home', headerBackVisible: false }}
        />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'AI Chatbot' }} />
        <Stack.Screen name="GalleryIngestion" component={GalleryIngestionScreen} options={{ title: 'Import Gallery' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
