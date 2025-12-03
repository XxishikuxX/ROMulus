import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { streamingService, ControllerInput } from './StreamingService';

// Standard gamepad button mapping (following Web Gamepad API)
export const BUTTON_MAP = {
  // Face buttons
  A: 0,        // Cross (PS) / A (Xbox) / B (Nintendo)
  B: 1,        // Circle (PS) / B (Xbox) / A (Nintendo)
  X: 2,        // Square (PS) / X (Xbox) / Y (Nintendo)
  Y: 3,        // Triangle (PS) / Y (Xbox) / X (Nintendo)
  
  // Shoulder buttons
  L1: 4,       // LB
  R1: 5,       // RB
  L2: 6,       // LT (also axis)
  R2: 7,       // RT (also axis)
  
  // Meta buttons
  SELECT: 8,   // Back / Share / Minus
  START: 9,    // Start / Options / Plus
  
  // Stick buttons
  L3: 10,      // Left stick press
  R3: 11,      // Right stick press
  
  // D-Pad
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
  
  // System buttons
  HOME: 16,    // PS / Xbox / Home
  CAPTURE: 17, // Share / Capture
};

// Axis mapping
export const AXIS_MAP = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3,
};

// Known controller profiles
export const CONTROLLER_PROFILES = {
  xbox: {
    name: 'Xbox Controller',
    vendorId: [0x045e], // Microsoft
    mapping: 'standard',
  },
  playstation: {
    name: 'PlayStation Controller',
    vendorId: [0x054c], // Sony
    mapping: 'standard',
  },
  nintendo: {
    name: 'Nintendo Controller',
    vendorId: [0x057e], // Nintendo
    mapping: 'nintendo', // Swap A/B, X/Y
  },
  '8bitdo': {
    name: '8BitDo Controller',
    vendorId: [0x2dc8],
    mapping: 'standard',
  },
  anbernic: {
    name: 'Anbernic Built-in',
    vendorId: [0x20d6],
    mapping: 'standard',
  },
  rogAlly: {
    name: 'ROG Ally Built-in',
    vendorId: [0x0b05], // ASUS
    mapping: 'standard',
  },
  steamDeck: {
    name: 'Steam Deck Built-in',
    vendorId: [0x28de], // Valve
    mapping: 'standard',
  },
  retroid: {
    name: 'Retroid Built-in',
    vendorId: [0x20d6],
    mapping: 'standard',
  },
  generic: {
    name: 'Generic Controller',
    vendorId: [],
    mapping: 'standard',
  },
};

// Deadzone settings
const DEFAULT_DEADZONE = 0.15;
const DEFAULT_TRIGGER_THRESHOLD = 0.1;

interface ControllerState {
  connected: boolean;
  type: keyof typeof CONTROLLER_PROFILES;
  name: string;
  buttons: boolean[];
  axes: number[];
  hapticSupport: boolean;
}

interface ControllerConfig {
  deadzone: number;
  triggerThreshold: number;
  swapSticks: boolean;
  invertLeftY: boolean;
  invertRightY: boolean;
  nintendoLayout: boolean;
  hapticEnabled: boolean;
  hapticIntensity: number;
}

class ControllerService {
  private state: ControllerState = {
    connected: false,
    type: 'generic',
    name: 'No Controller',
    buttons: new Array(18).fill(false),
    axes: [0, 0, 0, 0],
    hapticSupport: false,
  };

  private config: ControllerConfig = {
    deadzone: DEFAULT_DEADZONE,
    triggerThreshold: DEFAULT_TRIGGER_THRESHOLD,
    swapSticks: false,
    invertLeftY: false,
    invertRightY: false,
    nintendoLayout: false,
    hapticEnabled: true,
    hapticIntensity: 0.5,
  };

  private listeners: Map<string, Set<Function>> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private lastInputTime: number = 0;

  // Initialize controller detection
  async initialize(): Promise<void> {
    if (Platform.OS === 'android') {
      await this.initializeAndroid();
    } else if (Platform.OS === 'ios') {
      await this.initializeIOS();
    }
  }

  // Android controller initialization
  private async initializeAndroid(): Promise<void> {
    try {
      // Use native module for gamepad events
      const { GamepadModule } = NativeModules;
      const eventEmitter = new NativeEventEmitter(GamepadModule);

      // Listen for gamepad connections
      eventEmitter.addListener('onGamepadConnected', (event) => {
        this.handleControllerConnected(event);
      });

      eventEmitter.addListener('onGamepadDisconnected', () => {
        this.handleControllerDisconnected();
      });

      // Listen for input events
      eventEmitter.addListener('onGamepadInput', (event) => {
        this.handleInput(event);
      });

      // Check for already connected controllers
      const connectedGamepad = await GamepadModule.getConnectedGamepad();
      if (connectedGamepad) {
        this.handleControllerConnected(connectedGamepad);
      }

      // Start polling for input (fallback)
      this.startPolling();

    } catch (error) {
      console.warn('Native gamepad module not available, using fallback');
      this.startPolling();
    }
  }

  // iOS controller initialization
  private async initializeIOS(): Promise<void> {
    try {
      const { GameControllerModule } = NativeModules;
      const eventEmitter = new NativeEventEmitter(GameControllerModule);

      eventEmitter.addListener('controllerConnected', (event) => {
        this.handleControllerConnected(event);
      });

      eventEmitter.addListener('controllerDisconnected', () => {
        this.handleControllerDisconnected();
      });

      eventEmitter.addListener('controllerInput', (event) => {
        this.handleInput(event);
      });

      // Start discovery
      await GameControllerModule.startDiscovery();

    } catch (error) {
      console.warn('iOS GameController not available');
    }
  }

  // Handle controller connected
  private handleControllerConnected(event: any): void {
    const vendorId = event.vendorId || 0;
    
    // Detect controller type
    let type: keyof typeof CONTROLLER_PROFILES = 'generic';
    for (const [key, profile] of Object.entries(CONTROLLER_PROFILES)) {
      if (profile.vendorId.includes(vendorId)) {
        type = key as keyof typeof CONTROLLER_PROFILES;
        break;
      }
    }

    this.state = {
      connected: true,
      type,
      name: event.name || CONTROLLER_PROFILES[type].name,
      buttons: new Array(18).fill(false),
      axes: [0, 0, 0, 0],
      hapticSupport: event.hapticSupport || false,
    };

    // Auto-configure Nintendo layout
    if (type === 'nintendo') {
      this.config.nintendoLayout = true;
    }

    this.emit('connected', this.state);
    console.log(`Controller connected: ${this.state.name}`);
  }

  // Handle controller disconnected
  private handleControllerDisconnected(): void {
    this.state.connected = false;
    this.state.name = 'No Controller';
    this.emit('disconnected');
  }

  // Handle input events
  private handleInput(event: any): void {
    const now = Date.now();
    
    // Process button inputs
    if (event.buttons) {
      event.buttons.forEach((pressed: boolean, index: number) => {
        if (this.state.buttons[index] !== pressed) {
          this.state.buttons[index] = pressed;
          
          // Apply Nintendo layout swap if needed
          let buttonIndex = index;
          if (this.config.nintendoLayout) {
            buttonIndex = this.swapNintendoButtons(index);
          }

          const buttonName = Object.keys(BUTTON_MAP).find(
            key => BUTTON_MAP[key as keyof typeof BUTTON_MAP] === buttonIndex
          );

          if (buttonName) {
            this.sendButtonInput(buttonName, pressed);
          }
        }
      });
    }

    // Process axis inputs
    if (event.axes) {
      event.axes.forEach((value: number, index: number) => {
        // Apply deadzone
        const adjustedValue = this.applyDeadzone(value);
        
        // Apply stick swap if configured
        let axisIndex = index;
        if (this.config.swapSticks) {
          axisIndex = this.swapAxes(index);
        }

        // Apply Y-axis inversion
        let finalValue = adjustedValue;
        if ((axisIndex === 1 && this.config.invertLeftY) ||
            (axisIndex === 3 && this.config.invertRightY)) {
          finalValue = -adjustedValue;
        }

        if (this.state.axes[axisIndex] !== finalValue) {
          this.state.axes[axisIndex] = finalValue;
          this.sendAxisInput(axisIndex, finalValue);
        }
      });
    }

    this.lastInputTime = now;
    this.emit('input', this.state);
  }

  // Apply deadzone to axis value
  private applyDeadzone(value: number): number {
    const absValue = Math.abs(value);
    if (absValue < this.config.deadzone) {
      return 0;
    }
    // Scale remaining range
    const sign = value > 0 ? 1 : -1;
    return sign * ((absValue - this.config.deadzone) / (1 - this.config.deadzone));
  }

  // Swap Nintendo button layout (A<->B, X<->Y)
  private swapNintendoButtons(index: number): number {
    switch (index) {
      case BUTTON_MAP.A: return BUTTON_MAP.B;
      case BUTTON_MAP.B: return BUTTON_MAP.A;
      case BUTTON_MAP.X: return BUTTON_MAP.Y;
      case BUTTON_MAP.Y: return BUTTON_MAP.X;
      default: return index;
    }
  }

  // Swap left/right sticks
  private swapAxes(index: number): number {
    switch (index) {
      case 0: return 2;
      case 1: return 3;
      case 2: return 0;
      case 3: return 1;
      default: return index;
    }
  }

  // Send button input to streaming service
  private sendButtonInput(button: string, pressed: boolean): void {
    const input: ControllerInput = {
      type: 'button',
      timestamp: Date.now(),
      data: { button, pressed },
    };
    streamingService.sendInput(input);
  }

  // Send axis input to streaming service
  private sendAxisInput(axisIndex: number, value: number): void {
    const axisNames = ['leftX', 'leftY', 'rightX', 'rightY'];
    const input: ControllerInput = {
      type: 'axis',
      timestamp: Date.now(),
      data: { 
        axis: axisNames[axisIndex] as any, 
        value 
      },
    };
    streamingService.sendInput(input);
  }

  // Start polling (fallback for devices without native events)
  private startPolling(): void {
    if (this.pollInterval) return;
    
    this.pollInterval = setInterval(() => {
      // Poll for gamepad state changes
      // This is a fallback method
    }, 16); // ~60fps
  }

  // Stop polling
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // Trigger haptic feedback
  async vibrate(duration: number = 100, intensity?: number): Promise<void> {
    if (!this.state.hapticSupport || !this.config.hapticEnabled) return;
    
    const actualIntensity = intensity ?? this.config.hapticIntensity;
    
    try {
      if (Platform.OS === 'android') {
        const { GamepadModule } = NativeModules;
        await GamepadModule.vibrate(duration, actualIntensity);
      } else if (Platform.OS === 'ios') {
        const { GameControllerModule } = NativeModules;
        await GameControllerModule.vibrate(duration, actualIntensity);
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

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

  // Get current state
  getState(): ControllerState {
    return { ...this.state };
  }

  // Update configuration
  setConfig(config: Partial<ControllerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Get configuration
  getConfig(): ControllerConfig {
    return { ...this.config };
  }

  // Check if controller is connected
  isConnected(): boolean {
    return this.state.connected;
  }

  // Cleanup
  destroy(): void {
    this.stopPolling();
    this.listeners.clear();
  }
}

// Singleton instance
export const controllerService = new ControllerService();
