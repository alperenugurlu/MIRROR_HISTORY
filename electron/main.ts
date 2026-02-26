import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initDatabase } from './database';
import { registerIpcHandlers } from './ipc-handlers';
import { seedDefaultUser } from '../core/services/auth-service';
import { eventBus } from '../core/event-bus';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Mirror History',
    backgroundColor: '#f8f9fc',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  initDatabase();
  seedDefaultUser();
  registerIpcHandlers();
  createWindow();

  // Forward event bus events to renderer
  eventBus.on('mirror-history', (payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mirror-history-event', payload);
    }
  });

  // Start HTTP API server (non-blocking, dynamic import for Electron compat)
  try {
    const { createServer } = await import('../server/api');
    await createServer(31072);
  } catch (err) {
    console.error('[MirrorHistory] API server failed to start:', err);
  }

  // Start Telegram bot (non-blocking, dynamic import for Electron compat)
  try {
    const { startTelegramBot } = await import('../server/telegram');
    await startTelegramBot();
  } catch (err) {
    console.error('[MirrorHistory] Telegram bot failed to start:', err);
  }

  // Register connectors and start polling
  try {
    const { connectorManager } = await import('../core/services/connector-framework');
    const { googleCalendarConnector } = await import('../core/services/connectors/google-calendar');
    connectorManager.register(googleCalendarConnector);
    connectorManager.start();
  } catch (err) {
    console.error('[MirrorHistory] Connector manager failed to start:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
