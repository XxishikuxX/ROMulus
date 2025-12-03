import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  Text,
  Animated,
  Platform,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import Orientation from 'react-native-orientation-locker';
import KeepAwake from 'react-native-keep-awake';
import { useNavigation, useRoute } from '@react-navigation/native';

import VirtualGamepad from '../components/VirtualGamepad';
import { streamingService, QUALITY_PRESETS, QualityPreset } from '../services/StreamingService';
import { controllerService } from '../services/ControllerService';
import { useServerStore } from '../stores/serverStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface StreamStats {
  latency: number;
  fps: number;
  bitrate: number;
  packetLoss: number;
  quality: QualityPreset;
}

export default function GamePlayerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { gameId, gameTitle, system } = route.params as any;
  
  const serverUrl = useServerStore(state => state.serverUrl);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(true);
  const [currentQuality, setCurrentQuality] = useState<QualityPreset>('auto');
  const [stats, setStats] = useState<StreamStats>({
    latency: 0,
    fps: 0,
    bitrate: 0,
    packetLoss: 0,
    quality: 'auto',
  });
  
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hasPhysicalController = controllerService.isConnected();

  // Lock to landscape
  useEffect(() => {
    Orientation.lockToLandscape();
    KeepAwake.activate();
    StatusBar.setHidden(true);

    return () => {
      Orientation.unlockAllOrientations();
      KeepAwake.deactivate();
      StatusBar.setHidden(false);
    };
  }, []);

  // Initialize streaming
  useEffect(() => {
    const initStreaming = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Connect to streaming server
        await streamingService.connect(serverUrl!, gameId);

        // Listen for stream
        streamingService.on('stream', (stream: any) => {
          setStreamUrl(stream.toURL());
          setIsLoading(false);
        });

        // Listen for stats
        streamingService.on('stats', (newStats: StreamStats) => {
          setStats(newStats);
        });

        // Listen for errors
        streamingService.on('error', (err: Error) => {
          setError(err.message);
          setIsLoading(false);
        });

        // Listen for disconnection
        streamingService.on('disconnected', () => {
          setError('Connection lost. Please try again.');
        });

      } catch (err: any) {
        setError(err.message || 'Failed to connect');
        setIsLoading(false);
      }
    };

    initStreaming();

    return () => {
      streamingService.disconnect();
    };
  }, [serverUrl, gameId]);

  // Controller detection
  useEffect(() => {
    const handleControllerConnected = () => {
      setShowTouchControls(false);
    };

    const handleControllerDisconnected = () => {
      setShowTouchControls(true);
    };

    controllerService.on('connected', handleControllerConnected);
    controllerService.on('disconnected', handleControllerDisconnected);

    // Check initial state
    if (controllerService.isConnected()) {
      setShowTouchControls(false);
    }

    return () => {
      controllerService.off('connected', handleControllerConnected);
      controllerService.off('disconnected', handleControllerDisconnected);
    };
  }, []);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }

    setShowControls(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    controlsTimeout.current = setTimeout(() => {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setShowControls(false);
      });
    }, 3000);
  }, []);

  // Handle screen tap
  const handleScreenTap = () => {
    if (showControls) {
      // Hide immediately
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowControls(false);
      });
    } else {
      resetControlsTimer();
    }
  };

  // Quality change
  const handleQualityChange = (quality: QualityPreset) => {
    setCurrentQuality(quality);
    streamingService.setQuality(quality);
    resetControlsTimer();
  };

  // Pause/Resume
  const togglePause = () => {
    setIsPaused(!isPaused);
    // Send pause command to server
    streamingService.sendInput({
      type: 'button',
      timestamp: Date.now(),
      data: { button: 'PAUSE', pressed: true },
    });
    resetControlsTimer();
  };

  // Exit game
  const handleExit = () => {
    streamingService.disconnect();
    navigation.goBack();
  };

  // Toggle touch controls
  const toggleTouchControls = () => {
    setShowTouchControls(!showTouchControls);
    resetControlsTimer();
  };

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Connecting to {gameTitle}...</Text>
          <Text style={styles.loadingSubtext}>Starting {system} emulator</Text>
          
          {/* Loading animation */}
          <View style={styles.loadingDots}>
            {[0, 1, 2].map(i => (
              <Animated.View
                key={i}
                style={[
                  styles.loadingDot,
                  {
                    opacity: new Animated.Value(0.3),
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Stream */}
      {streamUrl && (
        <RTCView
          streamURL={streamUrl}
          style={styles.videoStream}
          objectFit="contain"
          zOrder={0}
        />
      )}

      {/* Touch area for showing/hiding controls */}
      <TouchableOpacity
        style={styles.touchArea}
        activeOpacity={1}
        onPress={handleScreenTap}
      />

      {/* Virtual Gamepad */}
      {showTouchControls && (
        <VirtualGamepad
          opacity={0.6}
          hapticFeedback={true}
          layout="default"
        />
      )}

      {/* Top Controls */}
      <Animated.View style={[styles.topControls, { opacity: controlsOpacity }]}>
        {/* Left: Exit button */}
        <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
          <Text style={styles.exitButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Center: Game info */}
        <View style={styles.gameInfo}>
          <Text style={styles.gameTitle}>{gameTitle}</Text>
          <Text style={styles.systemBadge}>{system}</Text>
        </View>

        {/* Right: Menu buttons */}
        <View style={styles.menuButtons}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setShowStats(!showStats)}>
            <Text style={styles.menuButtonText}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={toggleTouchControls}>
            <Text style={styles.menuButtonText}>🎮</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={togglePause}>
            <Text style={styles.menuButtonText}>{isPaused ? '▶️' : '⏸️'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Stats Overlay */}
      {showStats && (
        <View style={styles.statsOverlay}>
          <Text style={styles.statsTitle}>Stream Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.latency.toFixed(0)}ms</Text>
              <Text style={styles.statLabel}>Latency</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.fps.toFixed(0)}</Text>
              <Text style={styles.statLabel}>FPS</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(stats.bitrate / 1000000).toFixed(1)}Mbps</Text>
              <Text style={styles.statLabel}>Bitrate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.packetLoss.toFixed(1)}%</Text>
              <Text style={styles.statLabel}>Packet Loss</Text>
            </View>
          </View>
          
          {/* Quality selector */}
          <Text style={styles.qualityLabel}>Quality</Text>
          <View style={styles.qualityButtons}>
            {(['auto', 'low', 'medium', 'high', 'ultra'] as QualityPreset[]).map(q => (
              <TouchableOpacity
                key={q}
                style={[
                  styles.qualityButton,
                  currentQuality === q && styles.qualityButtonActive,
                ]}
                onPress={() => handleQualityChange(q)}
              >
                <Text style={[
                  styles.qualityButtonText,
                  currentQuality === q && styles.qualityButtonTextActive,
                ]}>
                  {q.charAt(0).toUpperCase() + q.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Controller connected indicator */}
      {hasPhysicalController && !showTouchControls && (
        <View style={styles.controllerIndicator}>
          <Text style={styles.controllerIndicatorText}>🎮 Controller Connected</Text>
        </View>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseText}>PAUSED</Text>
          <TouchableOpacity style={styles.resumeButton} onPress={togglePause}>
            <Text style={styles.resumeButtonText}>Resume</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoStream: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  touchArea: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 80,
  },
  
  // Top controls
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitButtonText: {
    fontSize: 20,
    color: '#fff',
  },
  gameInfo: {
    alignItems: 'center',
  },
  gameTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  systemBadge: {
    color: '#3b82f6',
    fontSize: 12,
    marginTop: 2,
  },
  menuButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 18,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#030305',
  },
  loadingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  loadingSubtext: {
    color: '#71717a',
    fontSize: 14,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 30,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  
  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#030305',
    padding: 40,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorText: {
    color: '#71717a',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Stats overlay
  statsOverlay: {
    position: 'absolute',
    top: 70,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 15,
    minWidth: 200,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statItem: {
    width: '45%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 10,
  },
  statValue: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 2,
  },
  qualityLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 8,
  },
  qualityButtons: {
    flexDirection: 'row',
    gap: 5,
  },
  qualityButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  qualityButtonActive: {
    backgroundColor: '#3b82f6',
  },
  qualityButtonText: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '600',
  },
  qualityButtonTextActive: {
    color: '#fff',
  },
  
  // Controller indicator
  controllerIndicator: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(34,197,94,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.5)',
  },
  controllerIndicatorText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Pause overlay
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  resumeButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 12,
  },
  resumeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
