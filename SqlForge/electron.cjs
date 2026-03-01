const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { spawn } = require('child_process');

let backendProcess = null;

function startBackend(callback) {
  let backendPath;
  let command;
  let args;

  if (app.isPackaged) {
    const platform = process.platform;
    let executableName = 'sqlforge-backend';
    if (platform === 'win32') {
      executableName += '.exe';
    }
    // In a packaged app, the backend executable is in the 'resources/bin' directory
    backendPath = path.join(process.resourcesPath, 'bin', executableName);
    command = backendPath;
    args = [];
  } else {
    // In development, run the backend using the shell script
    command = './run_backend.sh';
    args = [];
    backendPath = path.join(__dirname, '..', 'run_backend.sh'); // Path to run_backend.sh from frontend dir
  }
  
  if (app.isPackaged && !fs.existsSync(backendPath)) {
    console.error(`[Backend] Executable not found at ${backendPath}`);
    dialog.showErrorBox('Backend Error', `Backend executable not found at: ${backendPath}\nPlease ensure the application was packaged correctly.`);
    app.quit();
    return;
  }
  
  console.log(`[Backend] Starting backend process: ${command} ${args.join(' ')}`);
  
  try {
    backendProcess = spawn(command, args, { 
      shell: !app.isPackaged, // Use shell for .sh script in dev
      cwd: app.isPackaged ? path.dirname(backendPath) : path.join(__dirname, '..', 'SqlForge-Backend')
    });
  } catch (error) {
    console.error('[Backend] Failed to spawn backend process:', error);
    dialog.showErrorBox('Backend Error', 'Failed to start the backend process.');
    app.quit();
    return;
  }

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend STDOUT]: ${data}`);
    // Check for the Uvicorn startup message to confirm the backend is ready
    if (data.toString().includes('Uvicorn running on')) {
      if (callback) callback();
    }
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend STDERR]: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`[Backend] Process exited with code ${code}`);
    // You might want to handle unexpected exits here
  });
  
  backendProcess.on('error', (err) => {
    console.error('[Backend] Error with backend process:', err);
    dialog.showErrorBox('Backend Error', `An error occurred with the backend process: ${err.message}`);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('[Backend] Stopping backend process...');
    backendProcess.kill('SIGINT');
    backendProcess = null;
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = process.env.VITE_DEV_SERVER_URL
    ? process.env.VITE_DEV_SERVER_URL
    : url.format({
        pathname: path.join(__dirname, 'dist', 'index.html'),
        protocol: 'file:',
        slashes: true,
      });

  mainWindow.loadURL(startUrl);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

app.on('will-quit', stopBackend);

app.whenReady().then(() => {
  startBackend(() => {
    console.log('[Backend] Backend is ready, creating window.');
    createWindow();
  });

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
