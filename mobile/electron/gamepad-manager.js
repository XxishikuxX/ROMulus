/**
 * Gamepad Manager for Electron Desktop App
 * Handles physical controller input for Windows/Linux handhelds
 */

const { EventEmitter } = require('events');
const SDL2 = require('sdl2-gamecontroller'); // Native bindings to SDL2

// Button mapping (Standard Gamepad API)
const BUTTON_NAMES = [
  'A', 'B', 'X', 'Y',           // 0-3: Face buttons
  'L1', 'R1',                   // 4-5: Shoulder buttons
  'L2', 'R2',                   // 6-7: Triggers (also analog)
  'SELECT', 'START',            // 8-9: Meta buttons
  'L3', 'R3',                   // 10-11: Stick clicks
  'UP', 'DOWN', 'LEFT', 'RIGHT', // 12-15: D-Pad
  'HOME', 'CAPTURE',            // 16-17: System buttons
];

// Axis mapping
const AXIS_NAMES = [
  'leftX', 'leftY',
  'rightX', 'rightY',
  'l2', 'r2',
];

class GamepadManager extends EventEmitter {
  constructor() {
    super();
    
    this.gamepads = new Map();
    this.primaryGamepad = null;
    this.pollInterval = null;
    this.deadzone = 0.15;
    
    // State tracking
    this.buttonStates = new Array(18).fill(false);
    this.axisStates = new Array(6).fill(0);
    
    // Vibration support
    this.hapticSupport = false;
  }
  
  // Start polling for gamepad input
  start() {
    if (this.pollInterval) return;
    
    try {
      // Initialize SDL2 gamecontroller
      SDL2.init();
      
      // Check for already connected controllers
      this.refreshGamepads();
      
      // Poll at 120Hz for low latency
      this.pollInterval = setInterval(() => {
        this.poll();
      }, 8); // ~120fps
      
      // Listen for controller connect/disconnect
      SDL2.on('controllerdeviceadded', (event) => {
        this.handleControllerAdded(event.which);
      });
      
      SDL2.on('controllerdeviceremoved', (event) => {
        this.handleControllerRemoved(event.which);
      });
      
    } catch (error) {
      console.error('Failed to initialize gamepad manager:', error);
      // Fallback to browser Gamepad API style polling
      this.startFallbackPolling();
    }
  }
  
  // Fallback polling for systems without SDL2
  startFallbackPolling() {
    this.pollInterval = setInterval(() => {
      this.pollFallback();
    }, 16);
  }
  
  // Refresh connected gamepads
  refreshGamepads() {
    const count = SDL2.numJoysticks();
    
    for (let i = 0; i < count; i++) {
      if (SDL2.isGameController(i)) {
        const controller = SDL2.gameControllerOpen(i);
        if (controller) {
          const id = SDL2.joystickInstanceID(SDL2.gameControllerGetJoystick(controller));
          this.gamepads.set(id, {
            controller,
            name: SDL2.gameControllerName(controller),
            haptic: SDL2.hapticOpenFromJoystick(SDL2.gameControllerGetJoystick(controller)),
          });
          
          if (!this.primaryGamepad) {
            this.setPrimaryGamepad(id);
          }
        }
      }
    }
  }
  
  // Handle controller connected
  handleControllerAdded(deviceIndex) {
    if (SDL2.isGameController(deviceIndex)) {
      const controller = SDL2.gameControllerOpen(deviceIndex);
      if (controller) {
        const id = SDL2.joystickInstanceID(SDL2.gameControllerGetJoystick(controller));
        const name = SDL2.gameControllerName(controller);
        const haptic = SDL2.hapticOpenFromJoystick(SDL2.gameControllerGetJoystick(controller));
        
        this.gamepads.set(id, { controller, name, haptic });
        
        if (!this.primaryGamepad) {
          this.setPrimaryGamepad(id);
        }
        
        console.log(`Controller connected: ${name}`);
        this.emit('connected', { id, name, hapticSupport: !!haptic });
      }
    }
  }
  
  // Handle controller disconnected
  handleControllerRemoved(instanceId) {
    const gamepad = this.gamepads.get(instanceId);
    if (gamepad) {
      if (gamepad.haptic) {
        SDL2.hapticClose(gamepad.haptic);
      }
      SDL2.gameControllerClose(gamepad.controller);
      this.gamepads.delete(instanceId);
      
      if (this.primaryGamepad === instanceId) {
        this.primaryGamepad = null;
        // Select next available gamepad
        if (this.gamepads.size > 0) {
          this.setPrimaryGamepad(this.gamepads.keys().next().value);
        } else {
          this.emit('disconnected');
        }
      }
      
      console.log(`Controller disconnected: ${gamepad.name}`);
    }
  }
  
  // Set primary gamepad
  setPrimaryGamepad(id) {
    this.primaryGamepad = id;
    const gamepad = this.gamepads.get(id);
    if (gamepad) {
      this.hapticSupport = !!gamepad.haptic;
    }
  }
  
  // Poll for input
  poll() {
    SDL2.pumpEvents();
    
    if (!this.primaryGamepad) return;
    
    const gamepad = this.gamepads.get(this.primaryGamepad);
    if (!gamepad) return;
    
    const controller = gamepad.controller;
    let inputChanged = false;
    
    // Read buttons
    const buttonMappings = [
      SDL2.SDL_CONTROLLER_BUTTON_A,
      SDL2.SDL_CONTROLLER_BUTTON_B,
      SDL2.SDL_CONTROLLER_BUTTON_X,
      SDL2.SDL_CONTROLLER_BUTTON_Y,
      SDL2.SDL_CONTROLLER_BUTTON_LEFTSHOULDER,
      SDL2.SDL_CONTROLLER_BUTTON_RIGHTSHOULDER,
      -1, // L2 handled as axis
      -1, // R2 handled as axis
      SDL2.SDL_CONTROLLER_BUTTON_BACK,
      SDL2.SDL_CONTROLLER_BUTTON_START,
      SDL2.SDL_CONTROLLER_BUTTON_LEFTSTICK,
      SDL2.SDL_CONTROLLER_BUTTON_RIGHTSTICK,
      SDL2.SDL_CONTROLLER_BUTTON_DPAD_UP,
      SDL2.SDL_CONTROLLER_BUTTON_DPAD_DOWN,
      SDL2.SDL_CONTROLLER_BUTTON_DPAD_LEFT,
      SDL2.SDL_CONTROLLER_BUTTON_DPAD_RIGHT,
      SDL2.SDL_CONTROLLER_BUTTON_GUIDE,
      SDL2.SDL_CONTROLLER_BUTTON_MISC1,
    ];
    
    buttonMappings.forEach((mapping, index) => {
      if (mapping >= 0) {
        const pressed = SDL2.gameControllerGetButton(controller, mapping) === 1;
        if (this.buttonStates[index] !== pressed) {
          this.buttonStates[index] = pressed;
          inputChanged = true;
          
          this.emit('button', {
            button: BUTTON_NAMES[index],
            pressed,
            timestamp: Date.now(),
          });
        }
      }
    });
    
    // Read axes
    const axisMappings = [
      SDL2.SDL_CONTROLLER_AXIS_LEFTX,
      SDL2.SDL_CONTROLLER_AXIS_LEFTY,
      SDL2.SDL_CONTROLLER_AXIS_RIGHTX,
      SDL2.SDL_CONTROLLER_AXIS_RIGHTY,
      SDL2.SDL_CONTROLLER_AXIS_TRIGGERLEFT,
      SDL2.SDL_CONTROLLER_AXIS_TRIGGERRIGHT,
    ];
    
    axisMappings.forEach((mapping, index) => {
      let value = SDL2.gameControllerGetAxis(controller, mapping) / 32767;
      
      // Apply deadzone for sticks (not triggers)
      if (index < 4) {
        if (Math.abs(value) < this.deadzone) {
          value = 0;
        } else {
          // Scale remaining range
          const sign = value > 0 ? 1 : -1;
          value = sign * ((Math.abs(value) - this.deadzone) / (1 - this.deadzone));
        }
      }
      
      // Triggers are 0-1, convert L2/R2 to button presses
      if (index === 4 || index === 5) {
        const buttonIndex = index === 4 ? 6 : 7;
        const pressed = value > 0.5;
        if (this.buttonStates[buttonIndex] !== pressed) {
          this.buttonStates[buttonIndex] = pressed;
          inputChanged = true;
        }
      }
      
      if (Math.abs(this.axisStates[index] - value) > 0.01) {
        this.axisStates[index] = value;
        inputChanged = true;
        
        this.emit('axis', {
          axis: AXIS_NAMES[index],
          value,
          timestamp: Date.now(),
        });
      }
    });
    
    // Emit combined input event
    if (inputChanged) {
      this.emit('input', {
        buttons: [...this.buttonStates],
        axes: [...this.axisStates],
        timestamp: Date.now(),
      });
    }
  }
  
  // Fallback polling (no SDL2)
  pollFallback() {
    // Use node-hid or similar for direct HID access
    // This is a placeholder for systems without SDL2
  }
  
  // Vibrate controller
  async vibrate(duration = 100, intensity = 0.5) {
    if (!this.hapticSupport || !this.primaryGamepad) return false;
    
    const gamepad = this.gamepads.get(this.primaryGamepad);
    if (!gamepad || !gamepad.haptic) return false;
    
    try {
      // Simple rumble effect
      const effect = {
        type: SDL2.SDL_HAPTIC_LEFTRIGHT,
        leftright: {
          length: duration,
          large_magnitude: Math.round(intensity * 65535),
          small_magnitude: Math.round(intensity * 65535 * 0.5),
        },
      };
      
      const effectId = SDL2.hapticNewEffect(gamepad.haptic, effect);
      if (effectId >= 0) {
        SDL2.hapticRunEffect(gamepad.haptic, effectId, 1);
        
        // Clean up after duration
        setTimeout(() => {
          SDL2.hapticDestroyEffect(gamepad.haptic, effectId);
        }, duration + 50);
        
        return true;
      }
    } catch (error) {
      console.error('Vibration error:', error);
    }
    
    return false;
  }
  
  // Get current state
  getState() {
    return {
      connected: this.gamepads.size > 0,
      primaryGamepad: this.primaryGamepad,
      hapticSupport: this.hapticSupport,
      buttons: [...this.buttonStates],
      axes: [...this.axisStates],
      gamepads: Array.from(this.gamepads.entries()).map(([id, gp]) => ({
        id,
        name: gp.name,
      })),
    };
  }
  
  // Set deadzone
  setDeadzone(value) {
    this.deadzone = Math.max(0, Math.min(0.5, value));
  }
  
  // Stop polling
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    // Close all controllers
    for (const [id, gamepad] of this.gamepads) {
      if (gamepad.haptic) {
        SDL2.hapticClose(gamepad.haptic);
      }
      SDL2.gameControllerClose(gamepad.controller);
    }
    this.gamepads.clear();
    this.primaryGamepad = null;
    
    SDL2.quit();
  }
}

module.exports = GamepadManager;
