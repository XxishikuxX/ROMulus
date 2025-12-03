import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
  LayoutChangeEvent,
  Animated,
} from 'react-native';
import Svg, { Circle, Path, Rect, G, Text as SvgText } from 'react-native-svg';
import { streamingService, ControllerInput } from '../services/StreamingService';
import { controllerService, BUTTON_MAP } from '../services/ControllerService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VirtualGamepadProps {
  opacity?: number;
  hapticFeedback?: boolean;
  layout?: 'default' | 'compact' | 'minimal';
  showDpad?: boolean;
  showFaceButtons?: boolean;
  showShoulders?: boolean;
  showSticks?: boolean;
  showStartSelect?: boolean;
  onButtonPress?: (button: string, pressed: boolean) => void;
}

interface JoystickState {
  x: number;
  y: number;
  active: boolean;
}

const BUTTON_SIZE = 60;
const DPAD_SIZE = 140;
const STICK_SIZE = 100;
const STICK_KNOB_SIZE = 50;

export default function VirtualGamepad({
  opacity = 0.7,
  hapticFeedback = true,
  layout = 'default',
  showDpad = true,
  showFaceButtons = true,
  showShoulders = true,
  showSticks = true,
  showStartSelect = true,
  onButtonPress,
}: VirtualGamepadProps) {
  // Joystick states
  const [leftStick, setLeftStick] = useState<JoystickState>({ x: 0, y: 0, active: false });
  const [rightStick, setRightStick] = useState<JoystickState>({ x: 0, y: 0, active: false });
  
  // Button states
  const [pressedButtons, setPressedButtons] = useState<Set<string>>(new Set());

  // Refs for stick positions
  const leftStickCenter = useRef({ x: 0, y: 0 });
  const rightStickCenter = useRef({ x: 0, y: 0 });

  // Handle button press
  const handleButtonPress = useCallback((button: string, pressed: boolean) => {
    setPressedButtons(prev => {
      const next = new Set(prev);
      if (pressed) {
        next.add(button);
      } else {
        next.delete(button);
      }
      return next;
    });

    // Send input
    const input: ControllerInput = {
      type: 'button',
      timestamp: Date.now(),
      data: { button, pressed },
    };
    streamingService.sendInput(input);

    // Haptic feedback
    if (hapticFeedback && pressed) {
      controllerService.vibrate(20, 0.3);
    }

    onButtonPress?.(button, pressed);
  }, [hapticFeedback, onButtonPress]);

  // Create joystick pan responder
  const createJoystickResponder = (
    isLeft: boolean,
    centerRef: React.MutableRefObject<{ x: number; y: number }>,
    setStick: React.Dispatch<React.SetStateAction<JoystickState>>
  ) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        centerRef.current = { x: locationX, y: locationY };
        setStick({ x: 0, y: 0, active: true });
        
        if (hapticFeedback) {
          controllerService.vibrate(10, 0.2);
        }
      },
      
      onPanResponderMove: (evt, gestureState) => {
        const maxDistance = STICK_SIZE / 2 - STICK_KNOB_SIZE / 2;
        
        let dx = gestureState.dx;
        let dy = gestureState.dy;
        
        // Clamp to circle
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > maxDistance) {
          dx = (dx / distance) * maxDistance;
          dy = (dy / distance) * maxDistance;
        }
        
        // Normalize to -1 to 1
        const normalizedX = dx / maxDistance;
        const normalizedY = dy / maxDistance;
        
        setStick({ x: normalizedX, y: normalizedY, active: true });
        
        // Send axis input
        const input: ControllerInput = {
          type: 'axis',
          timestamp: Date.now(),
          data: { 
            axis: isLeft ? 'leftX' : 'rightX', 
            value: normalizedX 
          },
        };
        streamingService.sendInput(input);
        
        const inputY: ControllerInput = {
          type: 'axis',
          timestamp: Date.now(),
          data: { 
            axis: isLeft ? 'leftY' : 'rightY', 
            value: normalizedY 
          },
        };
        streamingService.sendInput(inputY);
      },
      
      onPanResponderRelease: () => {
        setStick({ x: 0, y: 0, active: false });
        
        // Reset axes
        ['leftX', 'leftY', 'rightX', 'rightY'].forEach(axis => {
          if ((isLeft && axis.startsWith('left')) || (!isLeft && axis.startsWith('right'))) {
            const input: ControllerInput = {
              type: 'axis',
              timestamp: Date.now(),
              data: { axis: axis as any, value: 0 },
            };
            streamingService.sendInput(input);
          }
        });
      },
    });
  };

  const leftStickResponder = useRef(
    createJoystickResponder(true, leftStickCenter, setLeftStick)
  ).current;
  
  const rightStickResponder = useRef(
    createJoystickResponder(false, rightStickCenter, setRightStick)
  ).current;

  // Render D-Pad
  const renderDpad = () => (
    <View style={[styles.dpadContainer, { opacity }]}>
      <View style={styles.dpad}>
        {/* Up */}
        <View
          style={[styles.dpadButton, styles.dpadUp, pressedButtons.has('UP') && styles.buttonPressed]}
          onTouchStart={() => handleButtonPress('UP', true)}
          onTouchEnd={() => handleButtonPress('UP', false)}
        >
          <Svg width={30} height={30} viewBox="0 0 24 24">
            <Path d="M12 4l-8 8h16z" fill="#fff" />
          </Svg>
        </View>
        
        {/* Down */}
        <View
          style={[styles.dpadButton, styles.dpadDown, pressedButtons.has('DOWN') && styles.buttonPressed]}
          onTouchStart={() => handleButtonPress('DOWN', true)}
          onTouchEnd={() => handleButtonPress('DOWN', false)}
        >
          <Svg width={30} height={30} viewBox="0 0 24 24">
            <Path d="M12 20l8-8H4z" fill="#fff" />
          </Svg>
        </View>
        
        {/* Left */}
        <View
          style={[styles.dpadButton, styles.dpadLeft, pressedButtons.has('LEFT') && styles.buttonPressed]}
          onTouchStart={() => handleButtonPress('LEFT', true)}
          onTouchEnd={() => handleButtonPress('LEFT', false)}
        >
          <Svg width={30} height={30} viewBox="0 0 24 24">
            <Path d="M4 12l8-8v16z" fill="#fff" />
          </Svg>
        </View>
        
        {/* Right */}
        <View
          style={[styles.dpadButton, styles.dpadRight, pressedButtons.has('RIGHT') && styles.buttonPressed]}
          onTouchStart={() => handleButtonPress('RIGHT', true)}
          onTouchEnd={() => handleButtonPress('RIGHT', false)}
        >
          <Svg width={30} height={30} viewBox="0 0 24 24">
            <Path d="M20 12l-8 8V4z" fill="#fff" />
          </Svg>
        </View>
        
        {/* Center */}
        <View style={styles.dpadCenter} />
      </View>
    </View>
  );

  // Render Face Buttons (A, B, X, Y)
  const renderFaceButtons = () => (
    <View style={[styles.faceButtonsContainer, { opacity }]}>
      {/* Y - Top */}
      <View
        style={[
          styles.faceButton,
          styles.buttonY,
          pressedButtons.has('Y') && styles.buttonPressed,
          { backgroundColor: '#fbbf24' }
        ]}
        onTouchStart={() => handleButtonPress('Y', true)}
        onTouchEnd={() => handleButtonPress('Y', false)}
      >
        <SvgText style={styles.buttonText}>Y</SvgText>
      </View>
      
      {/* X - Left */}
      <View
        style={[
          styles.faceButton,
          styles.buttonX,
          pressedButtons.has('X') && styles.buttonPressed,
          { backgroundColor: '#3b82f6' }
        ]}
        onTouchStart={() => handleButtonPress('X', true)}
        onTouchEnd={() => handleButtonPress('X', false)}
      >
        <SvgText style={styles.buttonText}>X</SvgText>
      </View>
      
      {/* B - Right */}
      <View
        style={[
          styles.faceButton,
          styles.buttonB,
          pressedButtons.has('B') && styles.buttonPressed,
          { backgroundColor: '#ef4444' }
        ]}
        onTouchStart={() => handleButtonPress('B', true)}
        onTouchEnd={() => handleButtonPress('B', false)}
      >
        <SvgText style={styles.buttonText}>B</SvgText>
      </View>
      
      {/* A - Bottom */}
      <View
        style={[
          styles.faceButton,
          styles.buttonA,
          pressedButtons.has('A') && styles.buttonPressed,
          { backgroundColor: '#22c55e' }
        ]}
        onTouchStart={() => handleButtonPress('A', true)}
        onTouchEnd={() => handleButtonPress('A', false)}
      >
        <SvgText style={styles.buttonText}>A</SvgText>
      </View>
    </View>
  );

  // Render Shoulder Buttons
  const renderShoulders = () => (
    <>
      {/* Left Shoulder */}
      <View style={[styles.shoulderContainer, styles.leftShoulder, { opacity }]}>
        <View
          style={[styles.shoulderButton, pressedButtons.has('L1') && styles.buttonPressed]}
          onTouchStart={() => handleButtonPress('L1', true)}
          onTouchEnd={() => handleButtonPress('L1', false)}
        >
          <SvgText style={styles.shoulderText}>L1</SvgText>
        </View>
        <View
          style={[styles.triggerButton, pressedButtons.has('L2') && styles.buttonPressed]}
          onTouchStart={() => handleButtonPress('L2', true)}
          onTouchEnd={() => handleButtonPress('L2', false)}
        >
          <SvgText style={styles.shoulderText}>L2</SvgText>
        </View>
      </View>
      
      {/* Right Shoulder */}
      <View style={[styles.shoulderContainer, styles.rightShoulder, { opacity }]}>
        <View
          style={[styles.shoulderButton, pressedButtons.has('R1') && styles.buttonPressed]}
          onTouchStart={() => handleButtonPress('R1', true)}
          onTouchEnd={() => handleButtonPress('R1', false)}
        >
          <SvgText style={styles.shoulderText}>R1</SvgText>
        </View>
        <View
          style={[styles.triggerButton, pressedButtons.has('R2') && styles.buttonPressed]}
          onTouchStart={() => handleButtonPress('R2', true)}
          onTouchEnd={() => handleButtonPress('R2', false)}
        >
          <SvgText style={styles.shoulderText}>R2</SvgText>
        </View>
      </View>
    </>
  );

  // Render Joystick
  const renderJoystick = (
    isLeft: boolean,
    stick: JoystickState,
    responder: any
  ) => {
    const knobX = (stick.x * (STICK_SIZE / 2 - STICK_KNOB_SIZE / 2));
    const knobY = (stick.y * (STICK_SIZE / 2 - STICK_KNOB_SIZE / 2));
    
    return (
      <View
        style={[
          styles.joystickContainer,
          isLeft ? styles.leftJoystick : styles.rightJoystick,
          { opacity }
        ]}
        {...responder.panHandlers}
      >
        {/* Base */}
        <View style={styles.joystickBase}>
          <View style={styles.joystickBaseInner} />
        </View>
        
        {/* Knob */}
        <View
          style={[
            styles.joystickKnob,
            {
              transform: [
                { translateX: knobX },
                { translateY: knobY },
              ],
            },
            stick.active && styles.joystickKnobActive,
          ]}
        />
      </View>
    );
  };

  // Render Start/Select
  const renderStartSelect = () => (
    <View style={[styles.metaButtonsContainer, { opacity }]}>
      <View
        style={[styles.metaButton, pressedButtons.has('SELECT') && styles.buttonPressed]}
        onTouchStart={() => handleButtonPress('SELECT', true)}
        onTouchEnd={() => handleButtonPress('SELECT', false)}
      >
        <SvgText style={styles.metaText}>SELECT</SvgText>
      </View>
      
      <View
        style={[styles.metaButton, pressedButtons.has('START') && styles.buttonPressed]}
        onTouchStart={() => handleButtonPress('START', true)}
        onTouchEnd={() => handleButtonPress('START', false)}
      >
        <SvgText style={styles.metaText}>START</SvgText>
      </View>
    </View>
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Left side */}
      <View style={styles.leftSide}>
        {showDpad && renderDpad()}
        {showSticks && renderJoystick(true, leftStick, leftStickResponder)}
      </View>
      
      {/* Center */}
      <View style={styles.center}>
        {showStartSelect && renderStartSelect()}
      </View>
      
      {/* Right side */}
      <View style={styles.rightSide}>
        {showFaceButtons && renderFaceButtons()}
        {showSticks && renderJoystick(false, rightStick, rightStickResponder)}
      </View>
      
      {/* Shoulders */}
      {showShoulders && renderShoulders()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  leftSide: {
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  center: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  rightSide: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  
  // D-Pad
  dpadContainer: {
    marginBottom: 20,
  },
  dpad: {
    width: DPAD_SIZE,
    height: DPAD_SIZE,
    position: 'relative',
  },
  dpadButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dpadUp: {
    top: 0,
    left: 45,
  },
  dpadDown: {
    bottom: 0,
    left: 45,
  },
  dpadLeft: {
    top: 45,
    left: 0,
  },
  dpadRight: {
    top: 45,
    right: 0,
  },
  dpadCenter: {
    position: 'absolute',
    top: 45,
    left: 45,
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  
  // Face Buttons
  faceButtonsContainer: {
    width: DPAD_SIZE,
    height: DPAD_SIZE,
    position: 'relative',
    marginBottom: 20,
  },
  faceButton: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonY: {
    top: 0,
    left: 40,
  },
  buttonX: {
    top: 40,
    left: 0,
  },
  buttonB: {
    top: 40,
    right: 0,
  },
  buttonA: {
    bottom: 0,
    left: 40,
  },
  buttonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonPressed: {
    opacity: 0.5,
    transform: [{ scale: 0.95 }],
  },
  
  // Shoulders
  shoulderContainer: {
    position: 'absolute',
    top: 20,
    flexDirection: 'row',
    gap: 10,
  },
  leftShoulder: {
    left: 20,
  },
  rightShoulder: {
    right: 20,
  },
  shoulderButton: {
    width: 70,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  triggerButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shoulderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // Joysticks
  joystickContainer: {
    width: STICK_SIZE,
    height: STICK_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftJoystick: {
    marginTop: 20,
  },
  rightJoystick: {
    marginTop: 20,
  },
  joystickBase: {
    width: STICK_SIZE,
    height: STICK_SIZE,
    borderRadius: STICK_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joystickBaseInner: {
    width: STICK_SIZE - 20,
    height: STICK_SIZE - 20,
    borderRadius: (STICK_SIZE - 20) / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  joystickKnob: {
    position: 'absolute',
    width: STICK_KNOB_SIZE,
    height: STICK_KNOB_SIZE,
    borderRadius: STICK_KNOB_SIZE / 2,
    backgroundColor: 'rgba(59,130,246,0.8)',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  joystickKnobActive: {
    backgroundColor: 'rgba(59,130,246,1)',
    shadowOpacity: 0.8,
  },
  
  // Meta buttons
  metaButtonsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 50,
  },
  metaButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
  metaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
