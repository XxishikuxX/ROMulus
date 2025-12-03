/**
 * ROMulus Desktop Client
 * Electron app for Windows/Linux handhelds (ROG Ally, Steam Deck, etc.)
 */

const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const GamepadManager = require('./gamepad-manager');
const StreamingClient = require('./streaming-client');

// Configuration
const IS_DEV = process.env.NODE_ENV === 'development';
const DEFAULT_SERVER_URL = 'http://localhost:3000';

// Window reference
let mainWindow = null;
let gamepadManager = null;
let streamingClient = null;

// Detect device type
function detectDevice() {
  const platform = process.platform;
  const productName = process.env.PRODUCT_NAME || '';
  
  if (platform === 'win32') {
    if (productName.includes('ROG Ally') || process.env.ASUS_HANDHELD) {
      return 'ROG_ALLY';
    }
    if (productName.includes('Legion Go')) {
      return 'LEGION_GO';
    }
    if (productName.includes('GPD')) {
      return 'GPD';
    }
    return 'WINDOWS_PC';
  }
  
  if (platform === 'linux') {
    if (process.env.SteamDeck || process.env.STEAM_DECK) {
      return 'STEAM_DECK';
    }
    return 'LINUX_PC';
  }
  
  return 'UNKNOWN';
}

// Create main window
function createWindow() {
  const device = detectDevice();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  // Determine window settings based on device
  let windowConfig = {
    width: Math.min(1280, width),
    height: Math.min(720, height),
    minWidth: 800,
    minHeight: 480,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    backgroundColor: '#030305',
    show: false,
    icon: path.join(__dirname, '../assets/icon.png'),
  };
  
  // Handheld-specific settings
  if (['ROG_ALLY', 'STEAM_DECK', 'LEGION_GO', 'GPD'].includes(device)) {
    windowConfig = {
      ...windowConfig,
      fullscreen: true,
      frame: false,
      kiosk: false,
      alwaysOnTop: false,
    };
  }
  
  mainWindow = new BrowserWindow(windowConfig);
  
  // Load the app
  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  
  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Initialize gamepad manager
    gamepadManager = new GamepadManager();
    gamepadManager.on('input', (input) => {
      mainWindow.webContents.send('gamepad-input', input);
    });
    gamepadManager.on('connected', (gamepad) => {
      mainWindow.webContents.send('gamepad-connected', gamepad);
    });
    gamepadManager.on('disconnected', () => {
      mainWindow.webContents.send('gamepad-disconnected');
    });
    gamepadManager.start();
    
    // Send device info
    mainWindow.webContents.send('device-info', {
      type: device,
      platform: process.platform,
      hasPhysicalControls: ['ROG_ALLY', 'STEAM_DECK', 'LEGION_GO', 'GPD'].includes(device),
    });
  });
  
  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (gamepadManager) {
      gamepadManager.stop();
      gamepadManager = null;
    }
    if (streamingClient) {
      streamingClient.disconnect();
      streamingClient = null;
    }
  });
  
  // Register global shortcuts
  registerShortcuts();
}

// Register keyboard shortcuts
function registerShortcuts() {
  // Toggle fullscreen
  globalShortcut.register('F11', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
  
  // Quick menu (Steam Deck uses this)
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    if (mainWindow) {
      mainWindow.webContents.send('show-quick-menu');
    }
  });
  
  // Exit
  globalShortcut.register('Alt+F4', () => {
    app.quit();
  });
}

// IPC Handlers
ipcMain.handle('connect-server', async (event, serverUrl, authToken) => {
  try {
    streamingClient = new StreamingClient(serverUrl, authToken);
    await streamingClient.connect();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-game', async (event, gameId) => {
  try {
    if (!streamingClient) {
      throw new Error('Not connected to server');
    }
    
    const stream = await streamingClient.startGame(gameId);
    return { success: true, streamId: stream.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-game', async () => {
  try {
    if (streamingClient) {
      await streamingClient.stopGame();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-input', (event, input) => {
  if (streamingClient) {
    streamingClient.sendInput(input);
  }
});

ipcMain.handle('set-quality', (event, quality) => {
  if (streamingClient) {
    streamingClient.setQuality(quality);
  }
});

ipcMain.handle('vibrate', async (event, duration, intensity) => {
  if (gamepadManager) {
    await gamepadManager.vibrate(duration, intensity);
    return true;
  }
  return false;
});

ipcMain.handle('get-gamepad-state', () => {
  if (gamepadManager) {
    return gamepadManager.getState();
  }
  return null;
});

ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
  }
  return false;
});

// App lifecycle
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
