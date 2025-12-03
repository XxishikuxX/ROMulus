import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { io, Socket } from 'socket.io-client';
import { useServerStore } from '../stores/serverStore';
import { Platform } from 'react-native';

// WebRTC Configuration
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Custom TURN server (configured in server settings)
  ],
  iceCandidatePoolSize: 10,
};

// Streaming quality presets
export const QUALITY_PRESETS = {
  low: { width: 854, height: 480, fps: 30, bitrate: 2000000 },
  medium: { width: 1280, height: 720, fps: 30, bitrate: 5000000 },
  high: { width: 1280, height: 720, fps: 60, bitrate: 10000000 },
  ultra: { width: 1920, height: 1080, fps: 60, bitrate: 20000000 },
  auto: { width: 0, height: 0, fps: 0, bitrate: 0 }, // Adaptive
};

export type QualityPreset = keyof typeof QUALITY_PRESETS;

interface StreamingState {
  isConnected: boolean;
  isStreaming: boolean;
  quality: QualityPreset;
  latency: number;
  fps: number;
  bitrate: number;
  packetLoss: number;
}

class StreamingService {
  private socket: Socket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  
  private state: StreamingState = {
    isConnected: false,
    isStreaming: false,
    quality: 'auto',
    latency: 0,
    fps: 0,
    bitrate: 0,
    packetLoss: 0,
  };

  private listeners: Map<string, Set<Function>> = new Map();

  // Event emitter
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  // Connect to streaming server
  async connect(serverUrl: string, sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Connect to signaling server
        this.socket = io(`${serverUrl}/stream`, {
          transports: ['websocket'],
          auth: {
            token: useServerStore.getState().authToken,
            sessionId,
          },
        });

        this.socket.on('connect', () => {
          console.log('Connected to streaming server');
          this.state.isConnected = true;
          this.emit('connected');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

        // Handle WebRTC signaling
        this.socket.on('offer', async (offer) => {
          await this.handleOffer(offer);
        });

        this.socket.on('ice-candidate', async (candidate) => {
          await this.handleIceCandidate(candidate);
        });

        this.socket.on('stream-ready', () => {
          this.state.isStreaming = true;
          this.emit('streaming', true);
          this.startStatsMonitoring();
        });

        this.socket.on('stream-error', (error) => {
          this.emit('error', error);
        });

        this.socket.on('disconnect', () => {
          this.state.isConnected = false;
          this.state.isStreaming = false;
          this.emit('disconnected');
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // Handle incoming WebRTC offer
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

      // Handle incoming tracks
      this.peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          this.emit('stream', this.remoteStream);
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket?.emit('ice-candidate', event.candidate);
        }
      };

      // Handle connection state
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection?.connectionState);
        this.emit('connectionState', this.peerConnection?.connectionState);
      };

      // Create data channel for input
      this.dataChannel = this.peerConnection.createDataChannel('input', {
        ordered: false,
        maxRetransmits: 0,
      });

      this.dataChannel.onopen = () => {
        console.log('Data channel open');
        this.emit('inputReady');
      };

      // Set remote description (offer)
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket?.emit('answer', answer);

    } catch (error) {
      console.error('Error handling offer:', error);
      this.emit('error', error);
    }
  }

  // Handle ICE candidate
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Send controller input
  sendInput(input: ControllerInput): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(input));
    }
  }

  // Set streaming quality
  setQuality(quality: QualityPreset): void {
    this.state.quality = quality;
    this.socket?.emit('set-quality', quality);
  }

  // Start monitoring stats
  private startStatsMonitoring(): void {
    this.statsInterval = setInterval(async () => {
      if (this.peerConnection) {
        const stats = await this.peerConnection.getStats();
        this.processStats(stats);
      }
    }, 1000);
  }

  // Process WebRTC stats
  private processStats(stats: RTCStatsReport): void {
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        // Calculate FPS
        this.state.fps = report.framesPerSecond || 0;
        
        // Calculate bitrate
        if (report.bytesReceived && report.timestamp) {
          const now = Date.now();
          const bytes = report.bytesReceived;
          // Bitrate calculation would need previous values stored
        }

        // Packet loss
        if (report.packetsLost && report.packetsReceived) {
          const total = report.packetsLost + report.packetsReceived;
          this.state.packetLoss = (report.packetsLost / total) * 100;
        }
      }

      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        // Latency (RTT / 2)
        this.state.latency = (report.currentRoundTripTime || 0) * 500;
      }
    });

    this.emit('stats', this.state);
  }

  // Get remote stream
  getStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Get current state
  getState(): StreamingState {
    return { ...this.state };
  }

  // Disconnect
  disconnect(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    this.dataChannel?.close();
    this.peerConnection?.close();
    this.socket?.disconnect();

    this.dataChannel = null;
    this.peerConnection = null;
    this.socket = null;
    this.remoteStream = null;

    this.state.isConnected = false;
    this.state.isStreaming = false;

    this.emit('disconnected');
  }
}

// Controller input types
export interface ControllerInput {
  type: 'button' | 'axis' | 'touch';
  timestamp: number;
  data: ButtonInput | AxisInput | TouchInput;
}

export interface ButtonInput {
  button: string;
  pressed: boolean;
}

export interface AxisInput {
  axis: 'leftX' | 'leftY' | 'rightX' | 'rightY' | 'l2' | 'r2';
  value: number; // -1 to 1 for sticks, 0 to 1 for triggers
}

export interface TouchInput {
  action: 'down' | 'move' | 'up';
  x: number;
  y: number;
  pointerId: number;
}

// Singleton instance
export const streamingService = new StreamingService();
