import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

const EmergencyIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={styles.emergencyIconContainer}>
    <Ionicons name="alert-circle" size={size + 4} color={color} />
  </View>
);

const MapIcon = ({ color, size }: { color: string; size: number }) => (
  <Ionicons name="map" size={size} color={color} />
);

const AlertsIcon = ({ color, size }: { color: string; size: number }) => (
  <Ionicons name="notifications" size={size} color={color} />
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ef4444',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#0f0f0f',
          borderTopColor: '#1f1f1f',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: '#0f0f0f',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Emergency',
          headerShown: false,
          tabBarIcon: EmergencyIcon,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          headerTitle: 'Nearby Alerts',
          tabBarIcon: MapIcon,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          headerTitle: 'Active Alerts',
          tabBarIcon: AlertsIcon,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  emergencyIconContainer: {
    backgroundColor: '#dc262620',
    borderRadius: 20,
    padding: 4,
  },
});
