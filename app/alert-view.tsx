import React, { useEffect, useState, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Vibration,
  Linking,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAlertStore } from '../src/store/alertStore';
import { useLocation } from '../src/hooks/useLocation';
import { getAlertDetails, respondToAlert } from '../src/services/api';
import { socketService } from '../src/services/socket';
import { playAlertBurst, stopEmergencyAlert } from '../src/services/emergencySound';

// ==================== ERROR BOUNDARY ====================
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AlertViewErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AlertView Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Ionicons name="alert-circle-outline" size={64} color="#f59e0b" />
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity 
            style={errorStyles.button}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
            <Text style={errorStyles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  message: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
});

// ==================== MAP IMPORTS (SAFE) ====================
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_DEFAULT: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  } catch (e) {
    console.log('react-native-maps not available');
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ==================== HELPER FUNCTIONS ====================
const COLORS = {
  victim: '#ef4444',
  responder: '#3b82f6',
  otherResponders: '#22c55e',
  route: '#3b82f6',
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const x = Math.sin(dLon) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  let bearing = Math.atan2(x, y) * (180 / Math.PI);
  return (bearing + 360) % 360;
}

function getDirectionText(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((bearing || 0) / 45) % 8;
  return directions[index];
}

function formatDistance(meters: number): string {
  if (!meters || isNaN(meters)) return '-- m';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatTimeAgo(isoString: string): string {
  if (!isoString) return 'just now';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    if (diffSecs < 10) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'recently';
  }
}

async function getAddressFromCoords(lat: number, lon: number): Promise<string> {
  if (!lat || !lon) return 'Location';
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'HumanAlert/1.0' } }
    );
    const data = await response.json();
    if (data.address) {
      const addr = data.address;
      const street = addr.road || addr.street || addr.pedestrian || '';
      const area = addr.suburb || addr.neighbourhood || addr.city || '';
      if (street && area) return `${street}, ${area}`;
      if (street) return street;
      if (area) return area;
    }
    if (data.display_name) {
      return data.display_name.split(',').slice(0, 2).join(',').trim();
    }
    return 'Location found';
  } catch {
    return 'Location';
  }
}

async function openNativeMapApp(destLat: number, destLon: number): Promise<void> {
  if (!destLat || !destLon) return;
  
  let url: string;
  let fallbackUrl: string = `https://www.google.com/maps/search/?api=1&query=${destLat},${destLon}`;

  try {
    if (Platform.OS === 'ios') {
      url = `maps://app?daddr=${destLat},${destLon}&dirflg=w`;
    } else if (Platform.OS === 'android') {
      url = `google.navigation:q=${destLat},${destLon}&mode=w`;
    } else {
      url = fallbackUrl;
    }

    const canOpen = await Linking.canOpenURL(url);
    await Linking.openURL(canOpen ? url : fallbackUrl);
  } catch {
    try {
      await Linking.openURL(fallbackUrl);
    } catch {
      Alert.alert('Error', 'Could not open map');
    }
  }
}

// ==================== MAIN COMPONENT ====================
function AlertViewContent() {
  const params = useLocalSearchParams<{ alertId: string }>();
  const mapRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alertDetails, setAlertDetails] = useState<any>(null);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [realTimeDistance, setRealTimeDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number>(0);
  const [address, setAddress] = useState<string>('Loading...');
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { deviceId, currentLocation, myActiveAlert } = useAlertStore();
  const { getCurrentLocation, startWatching, stopWatching } = useLocation();
  const webPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const alertId = params?.alertId;
  const isMyAlert = myActiveAlert?.alert_id === alertId;

  // Safe update distance and bearing
  const updateDistanceAndBearing = useCallback((myLat: number, myLon: number, alertLat: number, alertLon: number) => {
    try {
      if (!myLat || !myLon || !alertLat || !alertLon) return;
      const dist = calculateDistance(myLat, myLon, alertLat, alertLon);
      const bear = calculateBearing(myLat, myLon, alertLat, alertLon);
      setRealTimeDistance(dist);
      setBearing(bear);
      setMyLocation({ latitude: myLat, longitude: myLon });
    } catch (e) {
      console.error('Error updating distance:', e);
    }
  }, []);

  // Fetch alert details with proper error handling
  useEffect(() => {
    let isMounted = true;

    const fetchDetails = async () => {
      if (!alertId) {
        setError('No alert ID provided');
        setIsLoading(false);
        return;
      }

      try {
        const details = await getAlertDetails(alertId);
        
        if (!isMounted) return;

        if (!details || !details.latitude || !details.longitude) {
          setError('Invalid alert data');
          setIsLoading(false);
          return;
        }

        setAlertDetails(details);
        setLocationHistory(details.location_history || []);

        // Get address (non-blocking)
        getAddressFromCoords(details.latitude, details.longitude)
          .then(addr => isMounted && setAddress(addr))
          .catch(() => {});

        // Calculate initial distance
        if (currentLocation?.latitude && currentLocation?.longitude) {
          updateDistanceAndBearing(
            currentLocation.latitude,
            currentLocation.longitude,
            details.latitude,
            details.longitude
          );
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('Failed to fetch alert details:', err);
        if (isMounted) {
          setError(err?.message || 'Failed to load alert');
          setIsLoading(false);
        }
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
      stopEmergencyAlert();
    };
  }, [alertId, currentLocation, updateDistanceAndBearing]);

  // Watch location for real-time updates
  useEffect(() => {
    if (!alertDetails || isMyAlert) return;

    const watchLocation = async () => {
      try {
        if (Platform.OS === 'web') {
          const updateWebLocation = async () => {
            const loc = await getCurrentLocation();
            if (loc && alertDetails) {
              const latestLoc = locationHistory.length > 0
                ? locationHistory[locationHistory.length - 1]
                : { latitude: alertDetails.latitude, longitude: alertDetails.longitude };
              updateDistanceAndBearing(loc.latitude, loc.longitude, latestLoc.latitude, latestLoc.longitude);
            }
          };
          updateWebLocation();
          webPollIntervalRef.current = setInterval(updateWebLocation, 5000);
          return;
        }

        await startWatching((location) => {
          if (alertDetails) {
            const latestLoc = locationHistory.length > 0
              ? locationHistory[locationHistory.length - 1]
              : { latitude: alertDetails.latitude, longitude: alertDetails.longitude };
            updateDistanceAndBearing(location.latitude, location.longitude, latestLoc.latitude, latestLoc.longitude);
          }
        });
      } catch (e) {
        console.error('Error watching location:', e);
      }
    };

    watchLocation();

    return () => {
      stopWatching();
      if (webPollIntervalRef.current) {
        clearInterval(webPollIntervalRef.current);
        webPollIntervalRef.current = null;
      }
    };
  }, [alertDetails, isMyAlert, locationHistory, startWatching, stopWatching, updateDistanceAndBearing, getCurrentLocation]);

  // Socket subscriptions
  useEffect(() => {
    if (!alertId) return;

    try {
      socketService.subscribeToAlert(alertId);

      socketService.onAlertLocationUpdated((data: any) => {
        if (data?.alert_id === alertId && data?.latitude && data?.longitude) {
          const newLocation = {
            latitude: data.latitude,
            longitude: data.longitude,
            heading: data.heading,
            timestamp: data.timestamp,
          };
          setLocationHistory((prev) => [...prev, newLocation]);
          getAddressFromCoords(data.latitude, data.longitude)
            .then(setAddress)
            .catch(() => {});

          if (currentLocation?.latitude && currentLocation?.longitude) {
            updateDistanceAndBearing(currentLocation.latitude, currentLocation.longitude, data.latitude, data.longitude);
          }
        }
      });

      socketService.onAlertEnded((data: any) => {
        if (data?.alert_id === alertId) {
          stopEmergencyAlert();
          Alert.alert(
            'Alert Ended',
            data.reason === 'user_safe' ? 'The person has indicated they are SAFE!' : 'The alert has ended.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }
      });

      socketService.onResponderAdded((data: any) => {
        if (data?.alert_id === alertId) {
          setAlertDetails((prev: any) => prev ? { ...prev, responder_count: data.responder_count || 0 } : prev);
        }
      });
    } catch (e) {
      console.error('Socket subscription error:', e);
    }

    return () => {
      socketService.removeAllListeners();
    };
  }, [alertId, currentLocation, updateDistanceAndBearing]);

  // Handle respond - with proper error handling
  const handleRespond = async () => {
    if (!deviceId || !currentLocation?.latitude || !currentLocation?.longitude || !alertId) {
      Alert.alert('Error', 'Unable to get your location. Please try again.');
      return;
    }

    setIsResponding(true);
    try {
      const response = await respondToAlert({
        device_id: deviceId,
        alert_id: alertId,
        responder_latitude: currentLocation.latitude,
        responder_longitude: currentLocation.longitude,
      });

      // Immediate feedback vibration
      playAlertBurst();

      setHasResponded(true);
      
      if (response?.status !== 'already_responding') {
        Alert.alert(
          '🙏 Thank You!',
          `You're ${formatDistance(response?.distance || 0)} away.\n\nFollow the map to reach the person in need.`
        );
      }
    } catch (err: any) {
      console.error('Respond error:', err);
      Alert.alert('Error', 'Failed to respond. Please try again.');
    } finally {
      setIsResponding(false);
    }
  };

  // Handle open map app
  const handleOpenMapApp = () => {
    if (!alertDetails?.latitude || !alertDetails?.longitude) return;
    const latestLoc = locationHistory.length > 0
      ? locationHistory[locationHistory.length - 1]
      : { latitude: alertDetails.latitude, longitude: alertDetails.longitude };
    if (latestLoc?.latitude && latestLoc?.longitude) {
      openNativeMapApp(latestLoc.latitude, latestLoc.longitude);
    }
  };

  // LOADING STATE
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Loading alert...</Text>
      </View>
    );
  }

  // ERROR STATE
  if (error || !alertDetails) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error || 'Alert not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#ffffff" />
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // SAFE DATA EXTRACTION with defaults
  const victimLocation = locationHistory.length > 0
    ? locationHistory[locationHistory.length - 1]
    : { latitude: alertDetails?.latitude || 0, longitude: alertDetails?.longitude || 0 };

  const safeVictimLat = victimLocation?.latitude || alertDetails?.latitude || 0;
  const safeVictimLon = victimLocation?.longitude || alertDetails?.longitude || 0;

  const routeCoordinates = myLocation && safeVictimLat && safeVictimLon ? [
    { latitude: myLocation.latitude, longitude: myLocation.longitude },
    { latitude: safeVictimLat, longitude: safeVictimLon },
  ] : [];

  // MAIN RENDER
  return (
    <View style={styles.container}>
      {/* MAP SECTION */}
      {Platform.OS !== 'web' && MapView && safeVictimLat && safeVictimLon ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          showsUserLocation={false}
          initialRegion={{
            latitude: safeVictimLat,
            longitude: safeVictimLon,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          {/* Route line */}
          {routeCoordinates.length === 2 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={COLORS.route}
              strokeWidth={4}
              lineDashPattern={[10, 5]}
            />
          )}

          {/* Responder marker (You) */}
          {myLocation && !isMyAlert && (
            <Marker coordinate={myLocation} title="You" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.responderMarker}>
                <Ionicons name="navigate" size={18} color="#ffffff" />
              </View>
            </Marker>
          )}

          {/* Victim marker */}
          <Marker
            coordinate={{ latitude: safeVictimLat, longitude: safeVictimLon }}
            title="Person in Need"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.victimMarker}>
              <Ionicons name="warning" size={22} color="#ffffff" />
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={styles.webMapContainer}>
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={48} color="#6b7280" />
            <Text style={styles.mapPlaceholderText}>Map View</Text>
            <Text style={styles.mapPlaceholderSubtext}>{address}</Text>
          </View>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legendOverlay}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.victim }]} />
          <Text style={styles.legendText}>Victim</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.responder }]} />
          <Text style={styles.legendText}>You</Text>
        </View>
      </View>

      {/* Status Badge */}
      <View style={styles.statusOverlay}>
        <View style={[styles.statusBadge, alertDetails?.status !== 'active' && styles.endedBadge]}>
          <Ionicons
            name={alertDetails?.status === 'active' ? 'alert-circle' : 'checkmark-circle'}
            size={16}
            color="#ffffff"
          />
          <Text style={styles.statusBadgeText}>
            {alertDetails?.status === 'active' ? 'EMERGENCY' : 'ENDED'}
          </Text>
        </View>
      </View>

      {/* Bottom Info Panel */}
      <ScrollView style={styles.infoPanel} contentContainerStyle={styles.infoPanelContent}>
        {/* Address and Distance */}
        <View style={styles.locationInfo}>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={20} color="#ef4444" />
            <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
          </View>
          
          {!isMyAlert && realTimeDistance !== null && (
            <View style={styles.distanceRow}>
              <Text style={styles.distanceValue}>{formatDistance(realTimeDistance)}</Text>
              <View style={styles.directionBadge}>
                <Ionicons name="compass" size={14} color="#3b82f6" />
                <Text style={styles.directionText}>{getDirectionText(bearing)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={16} color="#22c55e" />
            <Text style={styles.statValue}>{alertDetails?.responder_count || 0}</Text>
            <Text style={styles.statLabel}>helping</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={16} color="#f59e0b" />
            <Text style={styles.statValue}>{formatTimeAgo(alertDetails?.timestamp)}</Text>
            <Text style={styles.statLabel}>ago</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="radio" size={16} color="#9ca3af" />
            <Text style={styles.statValue}>{alertDetails?.current_radius || 300}m</Text>
            <Text style={styles.statLabel}>radius</Text>
          </View>
        </View>

        {/* My Alert Notice */}
        {isMyAlert && (
          <View style={styles.myAlertNotice}>
            <Ionicons name="information-circle" size={18} color="#22c55e" />
            <Text style={styles.myAlertNoticeText}>This is YOUR alert. Go back to end it.</Text>
          </View>
        )}

        {/* Action Buttons */}
        {alertDetails?.status === 'active' && !isMyAlert && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.navigateButton} onPress={handleOpenMapApp}>
              <Ionicons name="navigate" size={22} color="#ffffff" />
              <Text style={styles.navigateButtonText}>Open Navigation</Text>
            </TouchableOpacity>

            {hasResponded ? (
              <View style={styles.respondedBanner}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.respondedText}>You're on your way!</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.respondButton}
                onPress={handleRespond}
                disabled={isResponding}
              >
                {isResponding ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="hand-right" size={20} color="#ffffff" />
                    <Text style={styles.respondButtonText}>I'M COMING TO HELP</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ==================== WRAPPED EXPORT WITH ERROR BOUNDARY ====================
export default function AlertViewScreen() {
  return (
    <AlertViewErrorBoundary>
      <AlertViewContent />
    </AlertViewErrorBoundary>
  );
}

// ==================== STYLES ====================
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
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#374151',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  map: {
    flex: 1,
  },
  webMapContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#9ca3af',
    fontSize: 18,
    marginTop: 12,
  },
  mapPlaceholderSubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  legendOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    padding: 10,
    zIndex: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
  },
  statusOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    zIndex: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  endedBadge: {
    backgroundColor: '#22c55e',
  },
  statusBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 6,
  },
  victimMarker: {
    backgroundColor: COLORS.victim,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  responderMarker: {
    backgroundColor: COLORS.responder,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  infoPanel: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '50%',
  },
  infoPanelContent: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  locationInfo: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 28,
  },
  distanceValue: {
    color: '#ef4444',
    fontSize: 28,
    fontWeight: 'bold',
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  directionText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 1,
  },
  myAlertNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14532d',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  myAlertNoticeText: {
    color: '#22c55e',
    marginLeft: 8,
    fontSize: 13,
    flex: 1,
  },
  actionButtons: {
    gap: 10,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 14,
  },
  navigateButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 14,
  },
  respondButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  respondedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14532d',
    paddingVertical: 16,
    borderRadius: 14,
  },
  respondedText: {
    color: '#22c55e',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
});
