import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface IncomingAlertBannerProps {
  distance: number;
  onViewAlert: () => void;
  onDismiss: () => void;
}

export const IncomingAlertBanner: React.FC<IncomingAlertBannerProps> = ({
  distance,
  onViewAlert,
  onDismiss,
}) => {
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)}km`;
    }
    return `${Math.round(meters)}m`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="alert-circle" size={28} color="#ffffff" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>🚨 HELP NEEDED NEARBY</Text>
          <Text style={styles.distance}>{formatDistance(distance)} away</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.viewButton} onPress={onViewAlert}>
          <Ionicons name="eye" size={18} color="#ffffff" />
          <Text style={styles.viewButtonText}>View & Respond</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#dc2626',
    margin: 12,
    borderRadius: 16,
    padding: 16,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  distance: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 10,
    marginRight: 10,
  },
  viewButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 14,
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dismissButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
});
