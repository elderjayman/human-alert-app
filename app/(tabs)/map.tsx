import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlertStore } from '../../src/store/alertStore';
import { useLocation } from '../../src/hooks/useLocation';
import {
  getNearbyAlerts,
  respondToAlert,
  updateDeviceLocation,
} from '../../src/services/api';

// Conditionally import react-native-maps only on native platforms
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let PROVIDER_DEFAULT: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Circle = Maps.Circle;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  } catch (e) {
    console.log('react-native-maps not available');
  }
}

export default function MapScreen() {
  const mapRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  const { deviceId, currentLocation, nearbyAlerts, setNearbyAlerts, setCurrentLocation } =
    useAlertStore();
  const { hasPermission, getCurrentLocation } = useLocation();

  const fetchNearbyAlerts = useCallback(async () => {
    if (!deviceId || !currentLocation) return;

    try {
      const response = await getNearbyAlerts(
        currentLocation.latitude,
        currentLocation.longitude,
        deviceId
      );
      setNearbyAlerts(response.alerts);
    } catch (error) {
      console.error('Failed to fetch nearby alerts:', error);
    }
  }, [deviceId, currentLocation, setNearbyAlerts]);

  // Initialize location and fetch alerts
  useEffect(() => {
    const init = async () => {
      if (hasPermission) {
        const location = await getCurrentLocation();
        if (location && deviceId) {
          try {
            await updateDeviceLocation({
              device_id: deviceId,
              latitude: location.latitude,
              longitude: location.longitude,
              heading: location.heading,
            });
          } catch (error) {
            console.error('Failed to update location:', error);
          }
        }
      }
      setIsLoading(false);
    };
    init();
  }, [hasPermission, getCurrentLocation, deviceId]);

  // Fetch alerts when location changes
  useEffect(() => {
    fetchNearbyAlerts();
  }, [fetchNearbyAlerts]);

  // Auto-refresh alerts every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchNearbyAlerts, 10000);
    return () => clearInterval(interval);
  }, [fetchNearbyAlerts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await getCurrentLocation();
    await fetchNearbyAlerts();
    setRefreshing(false);
  };

  const handleRespond = async (alert: any) => {
    if (!deviceId || !currentLocation) return;

    try {
      const response = await respondToAlert({
        device_id: deviceId,
        alert_id: alert.alert_id,
        responder_latitude: currentLocation.latitude,
        responder_longitude: currentLocation.longitude,
      });

      if (response.status === 'already_responding') {
        Alert.alert('Info', 'You are already marked as responding to this alert.');
      } else {
        Alert.alert(
          'Responding!',
          `You're ${Math.round(response.distance)}m away. The victim has been notified.`
        );
      }
    } catch (error) {
      console.error('Failed to respond:', error);
      Alert.alert('Error', 'Failed to mark as responding. Please try again.');
    }
  };

  const handleCenterOnUser = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={64} color="#6b7280" />
        <Text style={styles.errorText}>Location permission required</Text>
        <Text style={styles.errorSubtext}>
          Please enable location services to view nearby alerts
        </Text>
      </View>
    );
  }

  // Web fallback - show list view instead of map
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.webHeader}>
          <View style={styles.alertBadge}>
            <Ionicons name="alert-circle" size={16} color="#ffffff" />
            <Text style={styles.alertBadgeText}>
              {nearbyAlerts.length} alert{nearbyAlerts.length !== 1 ? 's' : ''} nearby
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="refresh" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.webMapPlaceholder}>
          <Ionicons name="map" size={64} color="#374151" />
          <Text style={styles.webMapTitle}>Map View</Text>
          <Text style={styles.webMapSubtitle}>
            Interactive map available on mobile app
          </Text>
          {currentLocation && (
            <Text style={styles.webMapCoords}>
              📍 Your location: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </Text>
          )}
        </View>

        <ScrollView style={styles.alertsList}>
          {nearbyAlerts.length === 0 ? (
            <View style={styles.noAlerts}>
              <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
              <Text style={styles.noAlertsText}>No alerts in your area</Text>
            </View>
          ) : (
            nearbyAlerts.map((alert) => (
              <View key={alert.alert_id} style={styles.alertItem}>
                <View style={styles.alertItemHeader}>
                  <View style={styles.alertItemBadge}>
                    <Ionicons name="alert-circle" size={16} color="#ffffff" />
                    <Text style={styles.alertItemBadgeText}>HELP NEEDED</Text>
                  </View>
                  <Text style={styles.alertItemDistance}>
                    {alert.distance < 1000
                      ? `${Math.round(alert.distance)}m`
                      : `${(alert.distance / 1000).toFixed(1)}km`}
                  </Text>
                </View>
                <View style={styles.alertItemInfo}>
                  <Text style={styles.alertItemInfoText}>
                    <Ionicons name="people" size={14} color="#22c55e" /> {alert.responder_count} responding
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.alertItemButton}
                  onPress={() => handleRespond(alert)}
                >
                  <Ionicons name="hand-right" size={16} color="#ffffff" />
                  <Text style={styles.alertItemButtonText}>I'm Responding</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // Native map view
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        mapType="standard"
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        initialRegion={{
          latitude: currentLocation?.latitude || 9.0579,
          longitude: currentLocation?.longitude || 7.4951,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {nearbyAlerts.map((alert) => (
          <React.Fragment key={alert.alert_id}>
            <Circle
              center={{
                latitude: alert.latitude,
                longitude: alert.longitude,
              }}
              radius={alert.current_radius}
              fillColor="rgba(239, 68, 68, 0.1)"
              strokeColor="rgba(239, 68, 68, 0.5)"
              strokeWidth={2}
            />
            <Marker
              coordinate={{
                latitude: alert.latitude,
                longitude: alert.longitude,
              }}
              onPress={() => setSelectedAlert(alert)}
            >
              <View style={styles.alertMarker}>
                <Ionicons name="alert-circle" size={32} color="#ef4444" />
              </View>
            </Marker>
          </React.Fragment>
        ))}
      </MapView>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleCenterOnUser}
        >
          <Ionicons name="locate" size={24} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="refresh" size={24} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Alert count badge */}
      <View style={styles.alertBadge}>
        <Ionicons name="alert-circle" size={16} color="#ffffff" />
        <Text style={styles.alertBadgeText}>
          {nearbyAlerts.length} alert{nearbyAlerts.length !== 1 ? 's' : ''} nearby
        </Text>
      </View>

      {/* Selected alert detail */}
      {selectedAlert && (
        <View style={styles.alertDetail}>
          <View style={styles.alertDetailHeader}>
            <Text style={styles.alertDetailTitle}>HELP NEEDED</Text>
            <TouchableOpacity onPress={() => setSelectedAlert(null)}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.alertDetailInfo}>
            <View style={styles.alertDetailRow}>
              <Ionicons name="navigate" size={20} color="#ef4444" />
              <Text style={styles.alertDetailText}>
                {selectedAlert.distance < 1000
                  ? `${Math.round(selectedAlert.distance)}m away`
                  : `${(selectedAlert.distance / 1000).toFixed(1)}km away`}
              </Text>
            </View>

            <View style={styles.alertDetailRow}>
              <Ionicons name="people" size={20} color="#22c55e" />
              <Text style={styles.alertDetailText}>
                {selectedAlert.responder_count} responding
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.respondButton}
            onPress={() => handleRespond(selectedAlert)}
          >
            <Ionicons name="hand-right" size={20} color="#ffffff" />
            <Text style={styles.respondButtonText}>I'm Responding</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorSubtext: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  map: {
    flex: 1,
  },
  alertMarker: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 4,
  },
  controls: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  controlButton: {
    backgroundColor: '#1f1f1f',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  alertBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 12,
  },
  alertDetail: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1f1f1f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  alertDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertDetailTitle: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  alertDetailInfo: {
    marginBottom: 16,
  },
  alertDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertDetailText: {
    color: '#ffffff',
    marginLeft: 10,
    fontSize: 16,
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
  },
  respondButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  // Web-specific styles
  webHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  refreshButton: {
    backgroundColor: '#374151',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapPlaceholder: {
    backgroundColor: '#1f1f1f',
    padding: 40,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  webMapTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  webMapSubtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  webMapCoords: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 16,
    fontFamily: 'monospace',
  },
  alertsList: {
    flex: 1,
    padding: 16,
  },
  noAlerts: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noAlertsText: {
    color: '#22c55e',
    fontSize: 16,
    marginTop: 12,
  },
  alertItem: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  alertItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertItemBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 10,
    marginLeft: 4,
  },
  alertItemDistance: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 16,
  },
  alertItemInfo: {
    marginBottom: 12,
  },
  alertItemInfoText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  alertItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
  },
  alertItemButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
  },
});
