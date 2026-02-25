import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useAlertStore } from '../src/store/alertStore';
import { socketService } from '../src/services/socket';
import { initializeAudio } from '../src/services/emergencySound';
import * as SplashScreen from 'expo-splash-screen';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { deviceId, loadDeviceId } = useAlertStore();

  useEffect(() => {
    const init = async () => {
      await loadDeviceId();
      
      // Initialize audio system for emergency sounds (non-blocking)
      if (Platform.OS !== 'web') {
        initializeAudio().catch(console.error);
      }
      
      await SplashScreen.hideAsync();
    };
    init();
  }, [loadDeviceId]);

  useEffect(() => {
    if (deviceId) {
      socketService.connect(deviceId);
    }

    return () => {
      socketService.disconnect();
    };
  }, [deviceId]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#0f0f0f',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#0f0f0f',
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="alert-view"
          options={{
            title: 'Emergency Alert',
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}
