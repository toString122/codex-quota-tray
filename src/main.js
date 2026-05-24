'use strict';

const path = require('node:path');
const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  ipcMain,
  screen,
  shell
} = require('electron');
const { MockQuotaProvider } = require('./quotaProvider');
const { createQuotaTrayImage } = require('./trayIcon');

const provider = new MockQuotaProvider();

let tray = null;
let window = null;
let statusBarWindow = null;
let snapshot = provider.getSnapshot();
let refreshTimer = null;
let notifiedStatus = 'good';
let statusBarVisible = true;

const STATUS_BAR_SIZE = {
  width: 330,
  height: 52
};

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('local.codex-quota-tray');
    createTray();
    createWindow();
    createStatusBarWindow();
    updateQuota('startup');
    refreshTimer = setInterval(() => updateQuota('timer'), 1000 * 20);
    screen.on('display-metrics-changed', positionStatusBar);
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  if (refreshTimer) clearInterval(refreshTimer);
});

function createTray() {
  tray = new Tray(createQuotaTrayImage(snapshot.codex.percentRemaining, snapshot.status));
  tray.setToolTip(formatTooltip(snapshot));
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
  rebuildTrayMenu();
}

function createWindow() {
  window = new BrowserWindow({
    width: 440,
    height: 620,
    minWidth: 390,
    minHeight: 560,
    show: false,
    title: 'Codex Quota Tray',
    backgroundColor: '#eef2f1',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  window.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });
}

function createStatusBarWindow() {
  statusBarWindow = new BrowserWindow({
    width: STATUS_BAR_SIZE.width,
    height: STATUS_BAR_SIZE.height,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: false,
    title: 'Codex Quota Status',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  statusBarWindow.setAlwaysOnTop(true, 'status');
  statusBarWindow.loadFile(path.join(__dirname, 'statusbar', 'index.html'));
  statusBarWindow.once('ready-to-show', () => {
    positionStatusBar();
    if (statusBarVisible) {
      statusBarWindow.showInactive();
    }
    statusBarWindow.webContents.send('quota:update', snapshot);
  });
  statusBarWindow.on('closed', () => {
    statusBarWindow = null;
  });
}

function showWindow() {
  if (!window) createWindow();
  window.show();
  window.focus();
  window.webContents.send('quota:update', snapshot);
}

function updateQuota(reason) {
  snapshot = provider.getSnapshot();

  if (tray) {
    tray.setImage(createQuotaTrayImage(snapshot.codex.percentRemaining, snapshot.status));
    tray.setToolTip(formatTooltip(snapshot));
    rebuildTrayMenu();
  }

  if (window && !window.isDestroyed()) {
    window.webContents.send('quota:update', snapshot);
  }

  if (statusBarWindow && !statusBarWindow.isDestroyed()) {
    statusBarWindow.webContents.send('quota:update', snapshot);
    if (statusBarVisible) {
      positionStatusBar();
    }
  }

  if (reason !== 'startup') {
    maybeNotify(snapshot);
  }

  return snapshot;
}

function rebuildTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Codex 剩余 ${snapshot.codex.percentRemaining}%`,
      enabled: false
    },
    {
      label: `API 预算剩余 ${snapshot.api.percentRemaining}%`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '显示状态面板',
      click: showWindow
    },
    {
      label: statusBarVisible ? '隐藏常驻文字' : '显示常驻文字',
      type: 'checkbox',
      checked: statusBarVisible,
      click: (menuItem) => setStatusBarVisible(menuItem.checked)
    },
    {
      label: '刷新模拟数据',
      click: () => {
        provider.refresh();
        updateQuota('manual');
      }
    },
    {
      label: '模拟消耗一次',
      click: () => {
        provider.consumeCodex();
        updateQuota('consume');
      }
    },
    {
      label: '重置模拟数据',
      click: () => {
        provider.reset();
        updateQuota('reset');
      }
    },
    { type: 'separator' },
    {
      label: '打开 Codex 页面',
      click: () => shell.openExternal('https://chatgpt.com/codex')
    },
    {
      label: '打开 API 用量页',
      click: () => shell.openExternal('https://platform.openai.com/usage')
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function setStatusBarVisible(visible) {
  statusBarVisible = visible;

  if (!statusBarWindow || statusBarWindow.isDestroyed()) {
    createStatusBarWindow();
  }

  if (statusBarVisible) {
    positionStatusBar();
    statusBarWindow.showInactive();
    statusBarWindow.webContents.send('quota:update', snapshot);
  } else {
    statusBarWindow.hide();
  }

  if (tray) {
    rebuildTrayMenu();
  }
}

function positionStatusBar() {
  if (!statusBarWindow || statusBarWindow.isDestroyed()) return;

  const display = screen.getPrimaryDisplay();
  const margin = 10;
  const x = display.workArea.x + display.workArea.width - STATUS_BAR_SIZE.width - margin;
  const y = display.workArea.y + display.workArea.height - STATUS_BAR_SIZE.height - margin;

  statusBarWindow.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: STATUS_BAR_SIZE.width,
    height: STATUS_BAR_SIZE.height
  });
}

function maybeNotify(nextSnapshot) {
  if (nextSnapshot.status === notifiedStatus) return;
  notifiedStatus = nextSnapshot.status;

  if (nextSnapshot.status === 'warn' || nextSnapshot.status === 'danger') {
    new Notification({
      title: 'Codex 余量提醒',
      body: `模拟 Codex 剩余 ${nextSnapshot.codex.percentRemaining}%`
    }).show();
  }
}

function formatTooltip(nextSnapshot) {
  return [
    `Codex 模拟余量：${nextSnapshot.codex.remaining}/${nextSnapshot.codex.limit} (${nextSnapshot.codex.percentRemaining}%)`,
    `API 模拟预算：$${nextSnapshot.api.remainingUsd.toFixed(2)} / $${nextSnapshot.api.budgetUsd.toFixed(2)}`
  ].join('\n');
}

ipcMain.handle('quota:get', () => snapshot);

ipcMain.handle('quota:refresh', () => {
  provider.refresh();
  return updateQuota('manual');
});

ipcMain.handle('quota:consume-codex', () => {
  provider.consumeCodex();
  return updateQuota('consume');
});

ipcMain.handle('quota:reset-mock', () => {
  provider.reset();
  return updateQuota('reset');
});

ipcMain.handle('window:show-panel', () => {
  showWindow();
});

ipcMain.handle('statusbar:hide', () => {
  setStatusBarVisible(false);
  return statusBarVisible;
});

ipcMain.handle('link:open-codex-usage', () => {
  shell.openExternal('https://chatgpt.com/codex');
});

ipcMain.handle('link:open-api-usage', () => {
  shell.openExternal('https://platform.openai.com/usage');
});
