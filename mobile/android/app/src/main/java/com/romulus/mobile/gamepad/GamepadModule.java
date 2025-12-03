package com.romulus.mobile.gamepad;

import android.content.Context;
import android.hardware.input.InputManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import androidx.annotation.NonNull;
import androidx.games.input.GameControllerManager;
import androidx.games.input.InputMappingProvider;

import java.util.ArrayList;
import java.util.List;

public class GamepadModule extends ReactContextBaseJavaModule implements InputManager.InputDeviceListener {
    private static final String MODULE_NAME = "GamepadModule";
    private final ReactApplicationContext reactContext;
    private InputManager inputManager;
    private int connectedGamepadId = -1;
    private Vibrator vibrator;
    
    // Button state tracking
    private boolean[] buttonStates = new boolean[18];
    private float[] axisStates = new float[6];
    
    public GamepadModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        
        // Initialize input manager
        inputManager = (InputManager) context.getSystemService(Context.INPUT_SERVICE);
        if (inputManager != null) {
            inputManager.registerInputDeviceListener(this, null);
        }
        
        // Initialize vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            if (vm != null) {
                vibrator = vm.getDefaultVibrator();
            }
        } else {
            vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        }
        
        // Check for already connected gamepads
        checkConnectedDevices();
    }
    
    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }
    
    // Check for connected gamepad devices
    private void checkConnectedDevices() {
        int[] deviceIds = inputManager.getInputDeviceIds();
        for (int deviceId : deviceIds) {
            InputDevice device = inputManager.getInputDevice(deviceId);
            if (device != null && isGamepad(device)) {
                handleGamepadConnected(device);
                break;
            }
        }
    }
    
    // Check if device is a gamepad
    private boolean isGamepad(InputDevice device) {
        int sources = device.getSources();
        return ((sources & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD) ||
               ((sources & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK);
    }
    
    // Handle gamepad connection
    private void handleGamepadConnected(InputDevice device) {
        connectedGamepadId = device.getId();
        
        WritableMap params = Arguments.createMap();
        params.putString("name", device.getName());
        params.putInt("vendorId", device.getVendorId());
        params.putInt("productId", device.getProductId());
        params.putBoolean("hapticSupport", device.getVibrator() != null && device.getVibrator().hasVibrator());
        
        sendEvent("onGamepadConnected", params);
    }
    
    // Handle gamepad disconnection
    private void handleGamepadDisconnected() {
        connectedGamepadId = -1;
        sendEvent("onGamepadDisconnected", null);
    }
    
    // Get connected gamepad info
    @ReactMethod
    public void getConnectedGamepad(Promise promise) {
        if (connectedGamepadId != -1) {
            InputDevice device = inputManager.getInputDevice(connectedGamepadId);
            if (device != null) {
                WritableMap result = Arguments.createMap();
                result.putString("name", device.getName());
                result.putInt("vendorId", device.getVendorId());
                result.putInt("productId", device.getProductId());
                result.putBoolean("hapticSupport", device.getVibrator() != null && device.getVibrator().hasVibrator());
                promise.resolve(result);
                return;
            }
        }
        promise.resolve(null);
    }
    
    // Get all connected gamepads
    @ReactMethod
    public void getConnectedGamepads(Promise promise) {
        WritableArray gamepads = Arguments.createArray();
        
        int[] deviceIds = inputManager.getInputDeviceIds();
        for (int deviceId : deviceIds) {
            InputDevice device = inputManager.getInputDevice(deviceId);
            if (device != null && isGamepad(device)) {
                WritableMap gamepad = Arguments.createMap();
                gamepad.putInt("id", device.getId());
                gamepad.putString("name", device.getName());
                gamepad.putInt("vendorId", device.getVendorId());
                gamepad.putInt("productId", device.getProductId());
                gamepads.pushMap(gamepad);
            }
        }
        
        promise.resolve(gamepads);
    }
    
    // Vibrate the gamepad
    @ReactMethod
    public void vibrate(int duration, double intensity, Promise promise) {
        try {
            if (connectedGamepadId != -1) {
                InputDevice device = inputManager.getInputDevice(connectedGamepadId);
                if (device != null) {
                    Vibrator deviceVibrator = device.getVibrator();
                    if (deviceVibrator != null && deviceVibrator.hasVibrator()) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            int amplitude = (int) (intensity * 255);
                            deviceVibrator.vibrate(VibrationEffect.createOneShot(duration, amplitude));
                        } else {
                            deviceVibrator.vibrate(duration);
                        }
                        promise.resolve(true);
                        return;
                    }
                }
            }
            
            // Fallback to device vibrator
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    int amplitude = (int) (intensity * 255);
                    vibrator.vibrate(VibrationEffect.createOneShot(duration, amplitude));
                } else {
                    vibrator.vibrate(duration);
                }
                promise.resolve(true);
            } else {
                promise.resolve(false);
            }
        } catch (Exception e) {
            promise.reject("VIBRATE_ERROR", e.getMessage());
        }
    }
    
    // Process key events (buttons)
    public boolean onKeyEvent(KeyEvent event) {
        if (event.getDeviceId() != connectedGamepadId) {
            return false;
        }
        
        int keyCode = event.getKeyCode();
        boolean pressed = event.getAction() == KeyEvent.ACTION_DOWN;
        
        int buttonIndex = mapKeyCodeToButton(keyCode);
        if (buttonIndex >= 0 && buttonIndex < buttonStates.length) {
            if (buttonStates[buttonIndex] != pressed) {
                buttonStates[buttonIndex] = pressed;
                sendInputEvent();
            }
            return true;
        }
        
        return false;
    }
    
    // Process motion events (sticks and triggers)
    public boolean onMotionEvent(MotionEvent event) {
        if (event.getDeviceId() != connectedGamepadId) {
            return false;
        }
        
        // Left stick
        float leftX = event.getAxisValue(MotionEvent.AXIS_X);
        float leftY = event.getAxisValue(MotionEvent.AXIS_Y);
        
        // Right stick
        float rightX = event.getAxisValue(MotionEvent.AXIS_Z);
        float rightY = event.getAxisValue(MotionEvent.AXIS_RZ);
        
        // Triggers
        float l2 = event.getAxisValue(MotionEvent.AXIS_LTRIGGER);
        float r2 = event.getAxisValue(MotionEvent.AXIS_RTRIGGER);
        
        // D-Pad (hat switch)
        float hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X);
        float hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y);
        
        // Update axis states
        boolean changed = false;
        if (axisStates[0] != leftX) { axisStates[0] = leftX; changed = true; }
        if (axisStates[1] != leftY) { axisStates[1] = leftY; changed = true; }
        if (axisStates[2] != rightX) { axisStates[2] = rightX; changed = true; }
        if (axisStates[3] != rightY) { axisStates[3] = rightY; changed = true; }
        if (axisStates[4] != l2) { axisStates[4] = l2; changed = true; }
        if (axisStates[5] != r2) { axisStates[5] = r2; changed = true; }
        
        // D-Pad as buttons
        buttonStates[12] = hatY < -0.5f; // UP
        buttonStates[13] = hatY > 0.5f;  // DOWN
        buttonStates[14] = hatX < -0.5f; // LEFT
        buttonStates[15] = hatX > 0.5f;  // RIGHT
        
        if (changed) {
            sendInputEvent();
        }
        
        return true;
    }
    
    // Map Android key codes to button indices
    private int mapKeyCodeToButton(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_BUTTON_A: return 0;
            case KeyEvent.KEYCODE_BUTTON_B: return 1;
            case KeyEvent.KEYCODE_BUTTON_X: return 2;
            case KeyEvent.KEYCODE_BUTTON_Y: return 3;
            case KeyEvent.KEYCODE_BUTTON_L1: return 4;
            case KeyEvent.KEYCODE_BUTTON_R1: return 5;
            case KeyEvent.KEYCODE_BUTTON_L2: return 6;
            case KeyEvent.KEYCODE_BUTTON_R2: return 7;
            case KeyEvent.KEYCODE_BUTTON_SELECT: return 8;
            case KeyEvent.KEYCODE_BUTTON_START: return 9;
            case KeyEvent.KEYCODE_BUTTON_THUMBL: return 10;
            case KeyEvent.KEYCODE_BUTTON_THUMBR: return 11;
            case KeyEvent.KEYCODE_DPAD_UP: return 12;
            case KeyEvent.KEYCODE_DPAD_DOWN: return 13;
            case KeyEvent.KEYCODE_DPAD_LEFT: return 14;
            case KeyEvent.KEYCODE_DPAD_RIGHT: return 15;
            case KeyEvent.KEYCODE_BUTTON_MODE: return 16;
            default: return -1;
        }
    }
    
    // Send input event to JavaScript
    private void sendInputEvent() {
        WritableMap params = Arguments.createMap();
        
        // Buttons
        WritableArray buttons = Arguments.createArray();
        for (boolean state : buttonStates) {
            buttons.pushBoolean(state);
        }
        params.putArray("buttons", buttons);
        
        // Axes
        WritableArray axes = Arguments.createArray();
        for (float value : axisStates) {
            axes.pushDouble(value);
        }
        params.putArray("axes", axes);
        
        params.putDouble("timestamp", System.currentTimeMillis());
        
        sendEvent("onGamepadInput", params);
    }
    
    // Send event to JavaScript
    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }
    
    // InputManager.InputDeviceListener implementation
    @Override
    public void onInputDeviceAdded(int deviceId) {
        InputDevice device = inputManager.getInputDevice(deviceId);
        if (device != null && isGamepad(device)) {
            handleGamepadConnected(device);
        }
    }
    
    @Override
    public void onInputDeviceRemoved(int deviceId) {
        if (deviceId == connectedGamepadId) {
            handleGamepadDisconnected();
        }
    }
    
    @Override
    public void onInputDeviceChanged(int deviceId) {
        // Handle device changes if needed
    }
}
