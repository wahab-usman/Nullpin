const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const iconPath = path.join(__dirname, '../public/icon.ico');

  const mainWindow = new BrowserWindow({
    title: 'NullPin — Zero-Trace File Drop',
    width: 1280,
    height: 840,
    minWidth: 380,
    minHeight: 640,
    backgroundColor: '#09090B',
    autoHideMenuBar: true,
    show: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Ensures Supabase HTTPS API requests from local file:// run without CORS restrictions
    },
  });
  mainWindow.setMenuBarVisibility(false);

  // Load the built Vite production app
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);

  // Show window smoothly once content is ready to prevent blank flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Route external web links to the user's default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if ((url.startsWith('http:') || url.startsWith('https:')) && !url.includes('localhost')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

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

