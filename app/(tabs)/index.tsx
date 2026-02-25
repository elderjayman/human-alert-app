import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
  Vibration,
  AppState,
  AppStateStatus,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { EmergencyButton } from '../../src/components/EmergencyButton';
import { StatusBar as AppStatusBar } from '../../src/components/StatusBar';
import { IncomingAlertBanner } from '../../src/components/IncomingAlertBanner';
import { useLocation } from '../../src/hooks/useLocation';
import { useNotifications } from '../../src/hooks/useNotifications';
import { useAlertStore, Alert as AlertType } from '../../src/store/alertStore';
import {
  registerDevice,
  triggerAlert,
  endAlert,
  getDeviceStatus,
  getNearbyAlerts,
  updateDeviceLocation,
  getNearbyUsersCount,
} from '../../src/services/api';
import { socketService } from '../../src/services/socket';

// Reverse geocode to get readable address
async function getAddressFromCoords(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'HumanAlert/1.0' } }
    );
    const data = await response.json();
    if (data.address) {
      const addr = data.address;
      // Prioritize street name
      const street = addr.road || addr.street || addr.pedestrian || addr.footway;
      const area = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city;
      if (street) {
        return area ? `${street}, ${area}` : street;
      }
      if (area) return area;
    }
    if (data.display_name) {
      const parts = data.display_name.split(',');
      return parts.slice(0, 2).join(',').trim();
    }
    return 'Your current location';
  } catch (error) {
    console.error('Geocoding error:', error);
    return 'Your current location';
  }
}

export default function HomeScreen() {
  const [initializing, setInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState<AlertType | null>(null);
  const [nearbyUsersCount, setNearbyUsersCount] = useState<number>(0);
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [alertStartTime, setAlertStartTime] = useState<number | null>(null);
  const [alertTimeRemaining, setAlertTimeRemaining] = useState<number>(0);
  const appState = useRef(AppState.currentState);

  // Alert duration in seconds (20 minutes)
  const ALERT_DURATION = 1200;

  const {
    deviceId,
    isConnected,
    myActiveAlert,
    nearbyAlerts,
    canTrigger,
    cooldownRemaining,
    currentLocation,
    setIsConnected,
    setMyActiveAlert,
    setNearbyAlerts,
    setCanTrigger,
    setCooldownRemaining,
    loadDeviceId,
    reset,
  } = useAlertStore();

  const { hasPermission, getCurrentLocation } = useLocation();
  const { expoPushToken, permissionGranted, sendLocalNotification } = useNotifications();

  // Initialize app
  useEffect(() => {
    const init = async () => {
      console.log('Initializing Human Alert...');
      const id = await loadDeviceId();
      console.log('Device ID:', id);
      setInitializing(false);
    };
    init();
  }, [loadDeviceId]);

  // Register device and set up real-time connection
  useEffect(() => {
    if (!deviceId) return;

    const setupDevice = async () => {
      try {
        // Register device with backend
        await registerDevice({
          device_id: deviceId,
          platform: Platform.OS,
          push_token: expoPushToken || undefined,
        });
        console.log('Device registered');

        // Connect to socket for real-time updates
        socketService.connect(deviceId);
        setIsConnected(true);

        // Listen for incoming alerts from OTHER users
        socketService.onAlertReceived((data) => {
          console.log('Received alert from another user:', data);
          
          // Show incoming alert banner
          setIncomingAlert({
            alert_id: data.alert_id,
            latitude: data.latitude,
            longitude: data.longitude,
            distance: data.distance,
            bearing: data.bearing || 0,
            timestamp: data.timestamp,
            current_radius: data.current_radius || 300,
            responder_count: 0,
          });

          // Vibrate and notify
          if (Platform.OS !== 'web') {
            Vibration.vibrate([0, 500, 200, 500, 200, 500]);
          }
          sendLocalNotification(
            '🚨 EMERGENCY ALERT',
            `Someone needs help ${Math.round(data.distance)}m away!`,
            { type: 'emergency_alert', alert_id: data.alert_id }
          );
        });

        // Listen for alert ended - PROPER RESET
        socketService.onAlertEnded((data) => {
          console.log('Alert ended:', data);
          
          // Clear my active alert if it matches
          if (myActiveAlert?.alert_id === data.alert_id) {
            setMyActiveAlert(null);
            setCurrentAddress('');
            // Reset the store state
            reset();
            
            // Show confirmation
            if (data.reason === 'user_safe') {
              Alert.alert(
                '✅ You Are Safe',
                'Your emergency alert has been closed. All responders have been notified.',
                [{ text: 'OK' }]
              );
            }
          }
          
          // Clear incoming alert if it matches
          if (incomingAlert?.alert_id === data.alert_id) {
            setIncomingAlert(null);
          }
          
          // Remove from nearby alerts
          setNearbyAlerts(nearbyAlerts.filter(a => a.alert_id !== data.alert_id));
        });

        // Listen for responders
        socketService.onResponderAdded((data) => {
          console.log('Responder added:', data);
          if (myActiveAlert?.alert_id === data.alert_id) {
            // Notify user that help is coming
            if (Platform.OS !== 'web') {
              Vibration.vibrate([0, 200, 100, 200]);
            }
            Alert.alert('🙌 Help is Coming!', `${data.responder_count} ${data.responder_count === 1 ? 'person is' : 'people are'} responding to your alert.`);
          }
        });

        // Check device status
        const status = await getDeviceStatus(deviceId);
        setCanTrigger(status.can_trigger_alert);
        setCooldownRemaining(status.cooldown_remaining);
        
        if (status.has_active_alert && status.active_alert_id) {
          setMyActiveAlert({
            alert_id: status.active_alert_id,
            latitude: currentLocation?.latitude || 0,
            longitude: currentLocation?.longitude || 0,
          });
        }

      } catch (error) {
        console.error('Failed to setup device:', error);
        setIsConnected(false);
      }
    };

    setupDevice();

    return () => {
      socketService.removeAllListeners();
    };
  }, [deviceId, expoPushToken]);

  // Update location periodically, fetch nearby alerts and nearby users count
  useEffect(() => {
    if (!deviceId || !hasPermission) return;

    const updateAndFetchData = async () => {
      const location = await getCurrentLocation();
      if (!location) return;

      try {
        // Update location on server
        await updateDeviceLocation({
          device_id: deviceId,
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading,
        });

        // Get readable address for current location
        if (!currentAddress || !myActiveAlert) {
          const addr = await getAddressFromCoords(location.latitude, location.longitude);
          setCurrentAddress(addr);
        }

        // Fetch nearby users count
        const usersData = await getNearbyUsersCount(
          location.latitude,
          location.longitude,
          deviceId,
          1000 // 1km radius
        );
        setNearbyUsersCount(usersData.nearby_users);

        // Fetch nearby alerts
        const response = await getNearbyAlerts(
          location.latitude,
          location.longitude,
          deviceId
        );
        
        const alerts = response.alerts || [];
        setNearbyAlerts(alerts);

        // Show incoming alert if there are new alerts from others
        if (alerts.length > 0 && !myActiveAlert && !incomingAlert) {
          setIncomingAlert(alerts[0]);
        }
      } catch (error) {
        console.error('Error updating data:', error);
      }
    };

    // Initial fetch
    updateAndFetchData();

    // Periodic updates - every 10 seconds for better responsiveness
    const interval = setInterval(updateAndFetchData, 10000);
    return () => clearInterval(interval);
  }, [deviceId, hasPermission, myActiveAlert, currentAddress]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining(Math.max(0, cooldownRemaining - 1));
      if (cooldownRemaining <= 1) {
        setCanTrigger(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Alert countdown timer - tracks time remaining until auto-end
  useEffect(() => {
    if (!myActiveAlert || !alertStartTime) {
      setAlertTimeRemaining(0);
      return;
    }

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - alertStartTime) / 1000);
      const remaining = Math.max(0, ALERT_DURATION - elapsed);
      setAlertTimeRemaining(remaining);

      // If alert time has ended, clear local state
      if (remaining <= 0) {
        // Backend will auto-end the alert, so we just clear local state
        setMyActiveAlert(null);
        setAlertStartTime(null);
        setCurrentAddress('');
        reset();
        Alert.alert(
          '⏱️ Alert Ended',
          'Your emergency alert has automatically ended after 20 minutes.',
          [{ text: 'OK' }]
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [myActiveAlert, alertStartTime, reset]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - refresh data
        if (deviceId && hasPermission) {
          getCurrentLocation();
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [deviceId, hasPermission, getCurrentLocation]);

  // Handle emergency button press - ONLY triggers new alerts (no manual ending)
  const handleEmergencyPress = useCallback(async () => {
    if (isProcessing) return;

    // If alert is active, don't do anything (button is disabled)
    if (myActiveAlert) {
      return;
    }

    // Check requirements for new alert
    if (!hasPermission) {
      Alert.alert(
        'Location Required',
        'Please enable location services to send an emergency alert.'
      );
      return;
    }

    if (!canTrigger) {
      Alert.alert(
        'Cooldown Active',
        `Please wait ${cooldownRemaining} seconds before sending another alert.`
      );
      return;
    }

    // Trigger new alert
    setIsProcessing(true);
    
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 200, 100, 200]);
    }

    try {
      const location = await getCurrentLocation();
      if (!location) {
        Alert.alert('Error', 'Unable to get your location. Please try again.');
        setIsProcessing(false);
        return;
      }

      // Get readable address BEFORE triggering alert
      const address = await getAddressFromCoords(location.latitude, location.longitude);
      setCurrentAddress(address);

      const response = await triggerAlert({
        device_id: deviceId!,
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading,
        trigger_type: 'button',
      });

      setMyActiveAlert({
        alert_id: response.alert_id,
        latitude: location.latitude,
        longitude: location.longitude,
      });

      // Store alert start time for countdown
      setAlertStartTime(Date.now());

      setCanTrigger(false);
      setCooldownRemaining(60);

      // Strong vibration to confirm
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      }

      // Show alert with readable location
      Alert.alert(
        '🚨 Emergency Alert Sent!',
        `Help is on the way!\n\n📍 Alert Location:\n${address}\n\n• Nearby users within 300m have been notified\n• Alert will expand to 600m after 20s\n• Maximum radius: 1km\n\nTap the GREEN button when you are SAFE.`
      );
    } catch (error: any) {
      console.error('Failed to trigger alert:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send alert. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [myActiveAlert, deviceId, hasPermission, canTrigger, cooldownRemaining, getCurrentLocation, isProcessing, reset]);

  // Handle viewing incoming alert
  const handleViewAlert = useCallback(() => {
    if (incomingAlert) {
      router.push({
        pathname: '/alert-view',
        params: { alertId: incomingAlert.alert_id },
      });
    }
  }, [incomingAlert]);

  // Handle dismissing incoming alert
  const handleDismissAlert = useCallback(() => {
    setIncomingAlert(null);
  }, []);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Starting Human Alert...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <AppStatusBar
        isConnected={isConnected}
        hasLocation={!!currentLocation}
        activeAlerts={nearbyAlerts.length + (myActiveAlert ? 1 : 0)}
      />

      {/* Incoming Alert Banner - Shows when OTHER user triggers alert */}
      {incomingAlert && !myActiveAlert && (
        <IncomingAlertBanner
          distance={incomingAlert.distance}
          onViewAlert={handleViewAlert}
          onDismiss={handleDismissAlert}
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="shield" size={28} color="#ef4444" />
          <Text style={styles.logoText}>HUMAN ALERT</Text>
        </View>
        <Text style={styles.subtitle}>Emergency Safety Network</Text>
        
        {/* Nearby Users Count Indicator */}
        {hasPermission && nearbyUsersCount > 0 && (
          <View style={styles.nearbyUsersBadge}>
            <Ionicons name="people" size={14} color="#22c55e" />
            <Text style={styles.nearbyUsersText}>
              {nearbyUsersCount} {nearbyUsersCount === 1 ? 'responder' : 'responders'} nearby
            </Text>
          </View>
        )}
        
        {Platform.OS !== 'web' && permissionGranted && (
          <View style={styles.notificationBadge}>
            <Ionicons name="notifications" size={12} color="#22c55e" />
            <Text style={styles.notificationText}>Notifications ON</Text>
          </View>
        )}
      </View>

      {/* Main Content - Emergency Button */}
      <View style={styles.content}>
        {isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.processingText}>
              Sending alert...
            </Text>
          </View>
        ) : (
          <EmergencyButton
            onPress={handleEmergencyPress}
            disabled={!canTrigger && !myActiveAlert}
            isTriggered={!!myActiveAlert}
            cooldownRemaining={cooldownRemaining}
            alertTimeRemaining={alertTimeRemaining}
          />
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Active alert info with location */}
        {myActiveAlert ? (
          <View style={styles.activeAlertCard}>
            <View style={styles.alertInfoRow}>
              <Ionicons name="radio" size={18} color="#f97316" />
              <Text style={styles.activeAlertText}>
                Alert ACTIVE
              </Text>
              {alertTimeRemaining > 0 && (
                <View style={styles.timerBadge}>
                  <Ionicons name="time" size={12} color="#f97316" />
                  <Text style={styles.timerText}>
                    {Math.floor(alertTimeRemaining / 60)}:{(alertTimeRemaining % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
              )}
            </View>
            {currentAddress && (
              <View style={styles.locationRow}>
                <Ionicons name="location" size={14} color="#fdba74" />
                <Text style={styles.locationText} numberOfLines={1}>{currentAddress}</Text>
              </View>
            )}
            <Text style={styles.alertHint}>Alert will auto-end after timeout. Help is on the way!</Text>
          </View>
        ) : (
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color="#6b7280" />
            <Text style={styles.infoText}>
              Press the emergency button to alert nearby users
            </Text>
          </View>
        )}

        {/* Current location display */}
        {!myActiveAlert && currentAddress && (
          <View style={styles.currentLocationCard}>
            <Ionicons name="location-outline" size={16} color="#9ca3af" />
            <Text style={styles.currentLocationText} numberOfLines={1}>
              {currentAddress}
            </Text>
          </View>
        )}

        {/* Permission warnings */}
        {!hasPermission && (
          <View style={styles.warningCard}>
            <Ionicons name="location-outline" size={18} color="#f59e0b" />
            <Text style={styles.warningText}>
              Location permission required
            </Text>
          </View>
        )}

        {Platform.OS !== 'web' && !permissionGranted && (
          <View style={styles.warningCard}>
            <Ionicons name="notifications-off-outline" size={18} color="#f59e0b" />
            <Text style={styles.warningText}>
              Enable notifications to receive alerts
            </Text>
          </View>
        )}

        {/* Device info */}
        <View style={styles.deviceRow}>
          <Text style={styles.deviceId}>Device: {deviceId?.slice(0, 20)}...</Text>
          <View style={styles.connectionDot}>
            <View style={[styles.dot, { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }]} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 1,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 4,
  },
  nearbyUsersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  nearbyUsersText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  notificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 12,
  },
  notificationText: {
    color: '#22c55e',
    fontSize: 11,
    marginLeft: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    color: '#9ca3af',
    marginTop: 16,
    fontSize: 16,
  },
  footer: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  infoText: {
    color: '#9ca3af',
    fontSize: 13,
    marginLeft: 10,
    flex: 1,
  },
  activeAlertCard: {
    backgroundColor: '#431407',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  alertInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeAlertText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timerText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 28,
  },
  locationText: {
    color: '#fdba74',
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  alertHint: {
    color: '#fdba74',
    fontSize: 11,
    marginTop: 8,
    marginLeft: 28,
    fontStyle: 'italic',
  },
  currentLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  currentLocationText: {
    color: '#9ca3af',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#422006',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 12,
    marginLeft: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  deviceId: {
    color: '#4b5563',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectionDot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
