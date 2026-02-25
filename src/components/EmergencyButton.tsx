import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmergencyButtonProps {
  onPress: () => void;
  disabled?: boolean;
  isTriggered?: boolean;
  cooldownRemaining?: number;
  alertTimeRemaining?: number; // Time remaining until auto-end
}

export const EmergencyButton: React.FC<EmergencyButtonProps> = ({
  onPress,
  disabled = false,
  isTriggered = false,
  cooldownRemaining = 0,
  alertTimeRemaining = 0,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!disabled && !isTriggered) {
      // Pulse animation for emergency button
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );

      pulseAnimation.start();
      glowAnimation.start();

      return () => {
        pulseAnimation.stop();
        glowAnimation.stop();
      };
    } else if (isTriggered) {
      // Steady glow for active alert
      pulseAnim.setValue(1);
      glowAnim.setValue(0.5);
    }
  }, [disabled, isTriggered, pulseAnim, glowAnim]);

  const buttonColor = isTriggered ? '#dc2626' : disabled ? '#4a4a4a' : '#dc2626';
  const glowColor = isTriggered ? '#f97316' : '#dc2626'; // Orange glow when active

  return (
    <View style={styles.container}>
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowAnim,
            backgroundColor: glowColor,
          },
        ]}
      />

      {/* Main button */}
      <Animated.View
        style={[
          styles.buttonOuter,
          {
            transform: [{ scale: pulseAnim }],
            backgroundColor: buttonColor,
            ...(Platform.OS !== 'web' && {
              shadowColor: buttonColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 20,
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.button, { backgroundColor: buttonColor }]}
          onPress={onPress}
          disabled={isTriggered || (disabled && cooldownRemaining > 0)}
          activeOpacity={0.8}
        >
          <View style={styles.buttonInner}>
            {isTriggered ? (
              <>
                <Ionicons name="radio" size={56} color="#ffffff" />
                <Text style={styles.buttonText}>ALERT ACTIVE</Text>
                {alertTimeRemaining > 0 ? (
                  <Text style={styles.buttonSubtext}>
                    {Math.floor(alertTimeRemaining / 60)}:{(alertTimeRemaining % 60).toString().padStart(2, '0')} remaining
                  </Text>
                ) : (
                  <Text style={styles.buttonSubtext}>Help is on the way</Text>
                )}
              </>
            ) : (
              <>
                <Ionicons name="alert-circle" size={56} color="#ffffff" />
                <Text style={styles.buttonText}>EMERGENCY</Text>
                {cooldownRemaining > 0 ? (
                  <Text style={styles.cooldownText}>Wait {cooldownRemaining}s</Text>
                ) : (
                  <Text style={styles.buttonSubtext}>Tap for help</Text>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: isTriggered ? '#f97316' : '#dc2626' }]} />
        <Text style={styles.statusText}>
          {isTriggered
            ? 'Alert ACTIVE - Help is coming'
            : disabled && cooldownRemaining > 0
            ? `Cooldown: ${cooldownRemaining}s`
            : 'Ready to send alert'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  buttonOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
  },
  button: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    letterSpacing: 2,
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  cooldownText: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 13,
  },
});
