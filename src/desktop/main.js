// PC Bastos Harvest Management System
// Electron Desktop Main Process
// Production-ready offline-first desktop application wrapper

const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let serverProcess = null;
const LOCAL_PORT = 3100;

// Path to terminal configuration file in OS AppData directory
const configPath = path.join(app.getPath('userData'), 'harvest-terminal-config.json');

function loadTerminalConfig() {
  const defaultConfig = {
    serverUrl: `http://localhost:${LOCAL_PORT}`,
    terminalId: `term-${require('os').hostname().toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    terminalCode: `DESK-${require('os').hostname().toUpperCase().substring(0, 8)}`,
    isStandaloneServer: true,
    autoSyncIntervalSeconds: 30
  };

  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...defaultConfig, ...data };
    }
  } catch (err) {
    console.warn('Failed to load terminal config, using defaults:', err);
  }
  return defaultConfig;
}

function saveTerminalConfig(newConfig) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save terminal config:', err);
    return false;
  }
}

// Start embedded local backend server if in standalone mode
function startEmbeddedServer() {
  try {
    process.env.PORT = LOCAL_PORT;
    process.env.NODE_ENV = 'production';
    
    // Ensure database path inside AppData for desktop apps
    const appDataDbPath = path.join(app.getPath('userData'), 'harvest.sqlite');
    process.env.DB_PATH = appDataDbPath;

    const { getDb } = require('../backend/db');
    const { ensureSeeded } = require('../backend/seed');
    const appBackend = require('../backend/app');

    // Run schema migrations and ensure initial accounts on desktop SQLite database
    ensureSeeded()
      .then(() => {
        const server = http.createServer(appBackend);
        server.listen(LOCAL_PORT, '127.0.0.1', () => {
          console.log(`Embedded Harvest Desktop Server listening at http://127.0.0.1:${LOCAL_PORT}`);
        });
      })
      .catch((err) => {
        console.error('Desktop DB migration / seed error:', err);
      });
  } catch (err) {
    console.error('Failed to start embedded desktop backend server:', err);
  }
}

function createMainWindow() {
  const terminalConfig = loadTerminalConfig();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'PC Bastos Harvest Management System 2026',
    icon: path.join(__dirname, '../frontend/src/assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // Load URL
  const targetUrl = terminalConfig.serverUrl || `http://localhost:${LOCAL_PORT}`;
  mainWindow.loadURL(targetUrl).catch(() => {
    // If remote URL is unreachable, fallback to local embedded server
    mainWindow.loadURL(`http://localhost:${LOCAL_PORT}`);
  });

  // Custom Desktop Application Menu
  const menuTemplate = [
    {
      label: 'PC Bastos Harvest',
      submenu: [
        {
          label: 'About PC Bastos Harvest 2026',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'PC Bastos Harvest Management System',
              message: 'PC Bastos Harvest Management System 2026\nVersion 1.0.0 (Production Desktop Edition)',
              detail: `Terminal ID: ${terminalConfig.terminalCode}\nMode: ${terminalConfig.isStandaloneServer ? 'Local Embedded DB' : 'Cloud Connected'}\nPresbyterian Church in Cameroon - PC Bastos Congregation`
            });
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Collection',
      submenu: [
        {
          label: '🔄 Synchronize Now',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('sync:trigger');
          }
        },
        {
          label: '🔍 Quick Contributor Search',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('search:focus');
          }
        },
        { type: 'separator' },
        {
          label: '🖨️ Print Receipt / Slip',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow) mainWindow.webContents.print({ silent: false, printBackground: true });
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Documentation',
          click: () => {
            shell.openExternal('https://github.com/pcbastos/harvest-2026');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Setup periodic background sync trigger for renderer (every 30s)
  const syncInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync:trigger');
    }
  }, (terminalConfig.autoSyncIntervalSeconds || 30) * 1000);

  mainWindow.on('closed', () => {
    clearInterval(syncInterval);
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('terminal:get-config', () => loadTerminalConfig());
ipcMain.handle('terminal:save-config', (event, newConfig) => saveTerminalConfig(newConfig));
ipcMain.handle('print:receipt', (event, options) => {
  if (mainWindow) {
    mainWindow.webContents.print(options || { silent: false, printBackground: true });
    return true;
  }
  return false;
});

// App Lifecycle
app.whenReady().then(() => {
  const config = loadTerminalConfig();
  if (config.isStandaloneServer || !config.serverUrl.startsWith('https://')) {
    startEmbeddedServer();
  }

  // Slight delay for local server startup before opening UI
  setTimeout(createMainWindow, 600);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
