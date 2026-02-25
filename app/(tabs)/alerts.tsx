import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlertStore } from '../../src/store/alertStore';
import { useLocation } from '../../src/hooks/useLocation';
import { AlertCard } from '../../src/components/AlertCard';
import {
  getNearbyAlerts,
  respondToAlert,
} from '../../src/services/api';
import { router } from 'expo-router';

export default function AlertsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  
  const { deviceId, currentLocation, nearbyAlerts, setNearbyAlerts } =
    useAlertStore();
  const { getCurrentLocation } = useLocation();

  const fetchAlerts = useCallback(async () => {
    if (!deviceId) return;

    let location = currentLocation;
    if (!location) {
      location = await getCurrentLocation();
    }

    if (!location) return;

    try {
      const response = await getNearbyAlerts(
        location.latitude,
        location.longitude,
        deviceId
      );
      setNearbyAlerts(response.alerts);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  }, [deviceId, currentLocation, getCurrentLocation, setNearbyAlerts]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await getCurrentLocation();
    await fetchAlerts();
    setRefreshing(false);
  };

  const handleRespond = async (alert: any) => {
    if (!deviceId || !currentLocation) {
      Alert.alert('Error', 'Unable to get your location');
      return;
    }

    try {
      const response = await respondToAlert({
        device_id: deviceId,
        alert_id: alert.alert_id,
        responder_latitude: currentLocation.latitude,
        responder_longitude: currentLocation.longitude,
      });

      if (response.status === 'already_responding') {
        Alert.alert('Info', 'You are already marked as responding.');
      } else {
        Alert.alert(
          'Responding!',
          `You're ${Math.round(response.distance)}m away. The victim has been notified.`
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to respond. Please try again.');
    }
  };

  const handleViewMap = () => {
    router.push('/(tabs)/map');
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="shield-checkmark" size={80} color="#22c55e" />
      <Text style={styles.emptyTitle}>All Clear!</Text>
      <Text style={styles.emptySubtext}>
        No emergency alerts in your area.
      </Text>
      <Text style={styles.emptySubtext}>
        You'll be notified instantly if someone needs help.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={nearbyAlerts}
        keyExtractor={(item) => item.alert_id}
        renderItem={({ item }) => (
          <AlertCard
            alert={item}
            onRespond={() => handleRespond(item)}
            onViewMap={handleViewMap}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ef4444"
            colors={['#ef4444']}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#22c55e',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
