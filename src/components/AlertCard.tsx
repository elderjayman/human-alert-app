import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AlertCardProps {
  alert: {
    alert_id: string;
    latitude: number;
    longitude: number;
    distance: number;
    bearing: number;
    timestamp: string;
    current_radius: number;
    responder_count: number;
  };
  onRespond: () => void;
  onViewMap: () => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  onRespond,
  onViewMap,
}) => {
  const getDirectionText = (bearing: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    return date.toLocaleTimeString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.alertBadge}>
          <Ionicons name="alert-circle" size={20} color="#ffffff" />
          <Text style={styles.alertText}>HELP NEEDED</Text>
        </View>
        <Text style={styles.timestamp}>{formatTime(alert.timestamp)}</Text>
      </View>

      <View style={styles.info}>
        <View style={styles.infoItem}>
          <Ionicons name="navigate" size={24} color="#ef4444" />
          <View style={styles.infoText}>
            <Text style={styles.infoValue}>{formatDistance(alert.distance)}</Text>
            <Text style={styles.infoLabel}>
              {getDirectionText(alert.bearing)} direction
            </Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="people" size={24} color="#22c55e" />
          <View style={styles.infoText}>
            <Text style={styles.infoValue}>{alert.responder_count}</Text>
            <Text style={styles.infoLabel}>Responding</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.mapButton} onPress={onViewMap}>
          <Ionicons name="map" size={18} color="#ffffff" />
          <Text style={styles.buttonText}>View Map</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.respondButton} onPress={onRespond}>
          <Ionicons name="hand-right" size={18} color="#ffffff" />
          <Text style={styles.buttonText}>I'm Responding</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f1f1f',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  alertText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 6,
  },
  timestamp: {
    color: '#9ca3af',
    fontSize: 12,
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    marginLeft: 8,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  respondButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
  },
});
