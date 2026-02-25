import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatusBarProps {
  isConnected: boolean;
  hasLocation: boolean;
  activeAlerts: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isConnected,
  hasLocation,
  activeAlerts,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.statusItem}>
        <Ionicons
          name={isConnected ? 'wifi' : 'wifi-outline'}
          size={14}
          color={isConnected ? '#22c55e' : '#ef4444'}
        />
        <Text style={[styles.statusText, { color: isConnected ? '#22c55e' : '#ef4444' }]}>
          {isConnected ? 'Online' : 'Offline'}
        </Text>
      </View>

      <View style={styles.statusItem}>
        <Ionicons
          name={hasLocation ? 'location' : 'location-outline'}
          size={14}
          color={hasLocation ? '#22c55e' : '#f59e0b'}
        />
        <Text style={[styles.statusText, { color: hasLocation ? '#22c55e' : '#f59e0b' }]}>
          {hasLocation ? 'GPS' : 'No GPS'}
        </Text>
      </View>

      {activeAlerts > 0 && (
        <View style={styles.alertBadge}>
          <Ionicons name="alert-circle" size={12} color="#ffffff" />
          <Text style={styles.alertText}>{activeAlerts}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  statusText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '500',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
  },
  alertText: {
    color: '#ffffff',
    fontSize: 11,
    marginLeft: 3,
    fontWeight: 'bold',
  },
});
