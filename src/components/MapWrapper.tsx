import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

// Platform-specific map import
let MapView: any;
let Marker: any;
let Circle: any;
let Polyline: any;
let PROVIDER_DEFAULT: any;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  Polyline = Maps.Polyline;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
}

interface MapWrapperProps {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  mapRef?: React.RefObject<any>;
  [key: string]: any;
}

export const MapWrapper: React.FC<MapWrapperProps> = ({
  children,
  style,
  initialRegion,
  mapRef,
  ...props
}) => {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webMapContainer, style]}>
        <View style={styles.webMapPlaceholder}>
          <Text style={styles.webMapTitle}>Map View</Text>
          <Text style={styles.webMapSubtitle}>
            Map available on mobile app
          </Text>
          {initialRegion && (
            <Text style={styles.webMapCoords}>
              📍 {initialRegion.latitude.toFixed(4)}, {initialRegion.longitude.toFixed(4)}
            </Text>
          )}
        </View>
        {children}
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={style}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      {...props}
    >
      {children}
    </MapView>
  );
};

// Export map components for native use
export const MapMarker = Platform.OS !== 'web' ? Marker : View;
export const MapCircle = Platform.OS !== 'web' ? Circle : View;
export const MapPolyline = Platform.OS !== 'web' ? Polyline : View;
export { PROVIDER_DEFAULT };

const styles = StyleSheet.create({
  webMapContainer: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapPlaceholder: {
    alignItems: 'center',
    padding: 40,
  },
  webMapTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  webMapSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 16,
  },
  webMapCoords: {
    color: '#ef4444',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
