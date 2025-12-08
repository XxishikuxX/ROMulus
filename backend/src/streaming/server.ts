import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

// Load hardware configuration
interface HardwareConfig {
  ENCODER_TYPE: string;
  ENCODER_NAME: string;
  GPU_TYPE: string;
  CPU_TYPE: string;
  STREAMING_BITRATE: string;
  STREAMING_RESOLUTION: string;
  STREAMING_FPS: string;
}

function loadHardwareConfig(): HardwareConfig {
  const configPath = '/opt/romulus/config/encoder.conf';
  const defaults: HardwareConfig = {
    ENCODER_TYPE: 'software',
    ENCODER_NAME: 'libx264',
    GPU_TYPE: 'SOFTWARE',
    CPU_TYPE: 'UNKNOWN',
    STREAMING_BITRATE: '6000k',
    STREAMING_RESOLUTION: '1920x1080',
    STREAMING_FPS: '60'
  };

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.includes('=') && !line.startsWith('#')) {
          const [key, value] = line.split('=').map(s => s.trim());
          if (key in defaults) {
            (defaults as any)[key] = value;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not load hardware config, using defaults');
  }

  return defaults;
}

// FFmpeg encoder configurations for different hardware
interface EncoderConfig {
  encoder: string;
  hwaccel?: string;
  hwaccelDevice?: string;
  extraArgs: string[];
}

function getEncoderConfig(hwConfig: HardwareConfig): EncoderConfig {
  switch (hwConfig.GPU_TYPE) {
    case 'NVIDIA':
      return {
        encoder: 'h264_nvenc',
        hwaccel: 'cuda',
        extraArgs: [
          '-preset', 'p4',  // Balance quality/speed
          '-tune', 'ull',   // Ultra low latency
          '-rc', 'cbr',
          '-cbr', 'true',
          '-zerolatency', '1',
          '-delay', '0',
          '-bf', '0',       // No B-frames for lower latency
          '-refs', '1',
          '-rc-lookahead', '0'
        ]
      };

    case 'AMD':
      return {
        encoder: 'h264_amf',
        hwaccel: 'auto',
        extraArgs: [
          '-usage', 'ultralowlatency',
          '-quality', 'speed',
          '-rc', 'cbr',
          '-bf', '0'
        ]
      };
      // Fallback to VAAPI for AMD
      // return {
      //   encoder: 'h264_vaapi',
      //   hwaccel: 'vaapi',
      //   hwaccelDevice: '/dev/dri/renderD128',
      //   extraArgs: [
      //     '-vf', 'format=nv12|vaapi,hwupload',
      //     '-rc_mode', 'CBR',
      //     '-bf', '0'
      //   ]
      // };

    case 'INTEL':
      return {
        encoder: 'h264_qsv',
        hwaccel: 'qsv',
        extraArgs: [
          '-preset', 'veryfast',
          '-look_ahead', '0',
          '-global_quality', '25',
          '-bf', '0'
        ]
      };
      // Alternative VAAPI for Intel
      // return {
      //   encoder: 'h264_vaapi',
      //   hwaccel: 'vaapi',
      //   hwaccelDevice: '/dev/dri/renderD128',
      //   extraArgs: [
      //     '-vf', 'format=nv12|vaapi,hwupload',
      //     '-rc_mode', 'CBR'
      //   ]
      // };

    case 'ARM_GPU':
      return {
        encoder: 'h264_v4l2m2m',
        extraArgs: [
          '-num_output_buffers', '32',
          '-num_capture_buffers', '16'
        ]
      };

    default:
      // Software fallback
      return {
        encoder: 'libx264',
        extraArgs: [
          '-preset', 'ultrafast',
          '-tune', 'zerolatency',
          '-profile:v', 'baseline',
          '-level', '3.1',
          '-bf', '0',
          '-refs', '1',
          '-threads', String(Math.min(4, require('os').cpus().length))
        ]
      };
  }
}

class StreamingSession extends EventEmitter {
  id: string;
  userId: string;
  display: string;
  ffmpegProcess: ChildProcess | null = null;
  clients: Set<WebSocket> = new Set();
  hwConfig: HardwareConfig;
  encoderConfig: EncoderConfig;
  isRunning = false;

  constructor(id: string, userId: string, hwConfig: HardwareConfig) {
    super();
    this.id = id;
    this.userId = userId;
    this.display = process.env.DISPLAY || ':99';
    this.hwConfig = hwConfig;
    this.encoderConfig = getEncoderConfig(hwConfig);
  }

  start(quality: string = '1080p') {
    if (this.isRunning) return;

    const resolution = this.getResolution(quality);
    const bitrate = this.getBitrate(quality);
    const fps = parseInt(this.hwConfig.STREAMING_FPS) || 60;

    console.log(`Starting stream: ${this.id}`);
    console.log(`  Encoder: ${this.encoderConfig.encoder}`);
    console.log(`  Hardware: ${this.hwConfig.GPU_TYPE}`);
    console.log(`  Resolution: ${resolution}`);
    console.log(`  Bitrate: ${bitrate}`);
    console.log(`  FPS: ${fps}`);

    const ffmpegArgs = this.buildFFmpegArgs(resolution, bitrate, fps);

    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      env: {
        ...process.env,
        DISPLAY: this.display
      }
    });

    this.isRunning = true;

    this.ffmpegProcess.stdout?.on('data', (data) => {
      // Broadcast video data to all connected clients
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    });

    this.ffmpegProcess.stderr?.on('data', (data) => {
      const message = data.toString();
      if (message.includes('error') || message.includes('Error')) {
        console.error(`FFmpeg error [${this.id}]:`, message);
      }
    });

    this.ffmpegProcess.on('close', (code) => {
      console.log(`Stream ${this.id} ended with code ${code}`);
      this.isRunning = false;
      this.emit('ended', code);
    });

    this.ffmpegProcess.on('error', (err) => {
      console.error(`FFmpeg process error [${this.id}]:`, err);
      this.isRunning = false;
      this.emit('error', err);
    });
  }

  private buildFFmpegArgs(resolution: string, bitrate: string, fps: number): string[] {
    const args: string[] = [
      '-y',
      '-loglevel', 'warning',
    ];

    // Hardware acceleration input (if supported)
    if (this.encoderConfig.hwaccel) {
      args.push('-hwaccel', this.encoderConfig.hwaccel);
      if (this.encoderConfig.hwaccelDevice) {
        args.push('-hwaccel_device', this.encoderConfig.hwaccelDevice);
      }
    }

    // Input from X11 display
    args.push(
      '-f', 'x11grab',
      '-framerate', String(fps),
      '-video_size', resolution,
      '-i', `${this.display}+0,0`
    );

    // Audio input (PulseAudio)
    args.push(
      '-f', 'pulse',
      '-ac', '2',
      '-i', 'default'
    );

    // Video encoding
    args.push(
      '-c:v', this.encoderConfig.encoder,
      '-b:v', bitrate,
      '-maxrate', bitrate,
      '-bufsize', `${parseInt(bitrate) * 2}k`,
      '-g', String(fps * 2),  // Keyframe every 2 seconds
      '-keyint_min', String(fps),
      ...this.encoderConfig.extraArgs
    );

    // Audio encoding
    args.push(
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000'
    );

    // Output format for streaming
    args.push(
      '-f', 'mpegts',
      '-muxdelay', '0',
      '-muxpreload', '0',
      'pipe:1'  // Output to stdout
    );

    return args;
  }

  private getResolution(quality: string): string {
    switch (quality) {
      case '4k': return '3840x2160';
      case '1440p': return '2560x1440';
      case '1080p': return '1920x1080';
      case '720p': return '1280x720';
      case '480p': return '854x480';
      default: return '1920x1080';
    }
  }

  private getBitrate(quality: string): string {
    switch (quality) {
      case '4k': return '35000k';
      case '1440p': return '16000k';
      case '1080p': return '8000k';
      case '720p': return '5000k';
      case '480p': return '2500k';
      default: return '8000k';
    }
  }

  addClient(ws: WebSocket) {
    this.clients.add(ws);
    console.log(`Client connected to stream ${this.id}. Total clients: ${this.clients.size}`);

    ws.on('close', () => {
      this.clients.delete(ws);
      console.log(`Client disconnected from stream ${this.id}. Total clients: ${this.clients.size}`);

      // Stop stream if no clients
      if (this.clients.size === 0) {
        this.stop();
      }
    });
  }

  stop() {
    if (this.ffmpegProcess && this.isRunning) {
      console.log(`Stopping stream ${this.id}`);
      this.ffmpegProcess.kill('SIGTERM');
      this.isRunning = false;
    }

    // Close all client connections
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
  }
}

// Main streaming server
class StreamingServer {
  private server;
  private wss: WebSocketServer;
  private sessions: Map<string, StreamingSession> = new Map();
  private hwConfig: HardwareConfig;

  constructor(port: number = 8080) {
    this.hwConfig = loadHardwareConfig();
    
    console.log('='.repeat(60));
    console.log('ROMulus Streaming Server');
    console.log('='.repeat(60));
    console.log(`Hardware Configuration:`);
    console.log(`  GPU Type: ${this.hwConfig.GPU_TYPE}`);
    console.log(`  CPU Type: ${this.hwConfig.CPU_TYPE}`);
    console.log(`  Encoder: ${this.hwConfig.ENCODER_NAME} (${this.hwConfig.ENCODER_TYPE})`);
    console.log('='.repeat(60));

    this.server = createServer((req, res) => {
      // Health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          sessions: this.sessions.size,
          hardware: {
            gpu: this.hwConfig.GPU_TYPE,
            cpu: this.hwConfig.CPU_TYPE,
            encoder: this.hwConfig.ENCODER_NAME
          }
        }));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const sessionId = url.pathname.replace('/stream/', '');

      if (!sessionId) {
        ws.close(4001, 'Session ID required');
        return;
      }

      let session = this.sessions.get(sessionId);
      
      if (!session) {
        // Create new session
        session = new StreamingSession(sessionId, 'unknown', this.hwConfig);
        this.sessions.set(sessionId, session);

        session.on('ended', () => {
          this.sessions.delete(sessionId);
        });

        // Get quality from query params
        const quality = url.searchParams.get('quality') || '1080p';
        session.start(quality);
      }

      session.addClient(ws);

      // Handle client messages (for input/control)
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(sessionId, message);
        } catch (e) {
          console.error('Invalid message:', e);
        }
      });
    });

    this.server.listen(port, () => {
      console.log(`Streaming server running on port ${port}`);
    });
  }

  private handleClientMessage(sessionId: string, message: any) {
    // Handle input events (keyboard, mouse, gamepad)
    switch (message.type) {
      case 'keydown':
      case 'keyup':
        this.sendKeyEvent(message);
        break;
      case 'mousemove':
      case 'mousedown':
      case 'mouseup':
        this.sendMouseEvent(message);
        break;
      case 'gamepad':
        this.sendGamepadEvent(message);
        break;
    }
  }

  private sendKeyEvent(event: any) {
    // Use xdotool to send key events
    const key = event.key;
    const action = event.type === 'keydown' ? 'keydown' : 'keyup';
    spawn('xdotool', [action, '--', key]);
  }

  private sendMouseEvent(event: any) {
    if (event.type === 'mousemove') {
      spawn('xdotool', ['mousemove', '--', String(event.x), String(event.y)]);
    } else {
      const button = event.button || 1;
      const action = event.type === 'mousedown' ? 'mousedown' : 'mouseup';
      spawn('xdotool', [action, '--', String(button)]);
    }
  }

  private sendGamepadEvent(event: any) {
    // Virtual gamepad input would be handled here
    // This would typically use uinput or similar
    console.log('Gamepad event:', event);
  }

  stopSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stop();
      this.sessions.delete(sessionId);
    }
  }

  shutdown() {
    console.log('Shutting down streaming server...');
    for (const session of this.sessions.values()) {
      session.stop();
    }
    this.sessions.clear();
    this.server.close();
  }
}

// Start server
const PORT = parseInt(process.env.STREAMING_PORT || '8080');
const server = new StreamingServer(PORT);

// Graceful shutdown
process.on('SIGTERM', () => {
  server.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  server.shutdown();
  process.exit(0);
});

export { StreamingServer, StreamingSession };
