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
const { ConfigStore } = require('./configStore');
const { CLIProxyAPIQuotaProvider } = require('./quotaProvider');
const { createQuotaTrayImage } = require('./trayIcon');

let configStore = null;
let provider = null;
let tray = null;
let window = null;
let statusBarWindow = null;
let snapshot = null;
let refreshTimer = null;
let refreshInFlight = false;
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
    configStore = new ConfigStore(app.getPath('userData'));
    provider = new CLIProxyAPIQuotaProvider(configStore);
    snapshot = provider.getSnapshot();
    createTray();
    createWindow();
    createStatusBarWindow();
    if (!snapshot.configured) {
      showWindow();
    }
    void updateQuota('startup');
    scheduleAutoRefresh();
    screen.on('display-metrics-changed', positionStatusBar);
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  if (refreshTimer) clearInterval(refreshTimer);
});

function createTray() {
  tray = new Tray(createQuotaTrayImage(getTrayPercent(snapshot), snapshot.status));
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

async function updateQuota(reason) {
  if (refreshInFlight) {
    return snapshot;
  }

  refreshInFlight = true;
  try {
    snapshot = await provider.refresh();
    renderSnapshot();

    if (reason !== 'startup') {
      maybeNotify(snapshot);
    }

    return snapshot;
  } finally {
    refreshInFlight = false;
  }
}

function renderSnapshot() {
  if (tray) {
    tray.setImage(createQuotaTrayImage(getTrayPercent(snapshot), snapshot.status));
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
}

function rebuildTrayMenu() {
  const publicConfig = configStore.getPublicConfig();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `5H 池剩余 ${snapshot.pool.fiveHour.remainingPercent}%`,
      enabled: false
    },
    {
      label: `Week 池剩余 ${snapshot.pool.weekly.remainingPercent}%`,
      enabled: false
    },
    {
      label: `可用账号 ${snapshot.pool.availableAccounts}/${snapshot.pool.totalAccounts}`,
      enabled: false
    },
    {
      label: publicConfig.autoRefreshEnabled
        ? `自动刷新：${formatInterval(publicConfig.refreshIntervalSeconds)}`
        : '自动刷新：关闭',
      enabled: false
    },
    { type: 'separator' },
    {
      label: '显示状态面板',
      click: showWindow
    },
    {
      label: '配置 CLIProxyAPI',
      click: showWindow
    },
    {
      label: statusBarVisible ? '隐藏常驻文字' : '显示常驻文字',
      type: 'checkbox',
      checked: statusBarVisible,
      click: (menuItem) => setStatusBarVisible(menuItem.checked)
    },
    {
      label: '刷新真实额度',
      click: () => {
        void updateQuota('manual');
      }
    },
    { type: 'separator' },
    {
      label: '打开 CLIProxyAPI',
      click: () => shell.openExternal(configStore.getPublicConfig().baseUrl)
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
      body: `Codex Plus 账号池有效余量 ${nextSnapshot.pool.effectivePercent}%`
    }).show();
  }
}

function formatTooltip(nextSnapshot) {
  if (!nextSnapshot.configured) {
    return [
      'CLIProxyAPI 未配置',
      '打开状态面板填写 API 地址和管理密钥'
    ].join('\n');
  }

  return [
    `Codex Plus 账号池：有效 ${nextSnapshot.pool.effectivePercent}%`,
    `5H：${nextSnapshot.pool.fiveHour.remainingPercent}% | Week：${nextSnapshot.pool.weekly.remainingPercent}%`,
    `可用账号：${nextSnapshot.pool.availableAccounts}/${nextSnapshot.pool.totalAccounts}`
  ].join('\n');
}

function getTrayPercent(nextSnapshot) {
  return nextSnapshot?.pool?.effectivePercent ?? nextSnapshot?.codex?.percentRemaining ?? 0;
}

ipcMain.handle('quota:get', () => snapshot);

ipcMain.handle('quota:refresh', () => {
  return updateQuota('manual');
});

ipcMain.handle('config:get', () => {
  return configStore.getPublicConfig();
});

ipcMain.handle('config:save', async (_event, nextConfig) => {
  configStore.save(nextConfig || {});
  scheduleAutoRefresh();
  return {
    config: configStore.getPublicConfig(),
    snapshot: await updateQuota('config')
  };
});

ipcMain.handle('window:show-panel', () => {
  showWindow();
});

ipcMain.handle('statusbar:hide', () => {
  setStatusBarVisible(false);
  return statusBarVisible;
});

ipcMain.handle('link:open-api-usage', () => {
  shell.openExternal(configStore.getPublicConfig().baseUrl);
});

function scheduleAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  const publicConfig = configStore.getPublicConfig();
  if (!publicConfig.autoRefreshEnabled) return;

  refreshTimer = setInterval(() => {
    void updateQuota('timer');
  }, publicConfig.refreshIntervalSeconds * 1000);

  if (tray) {
    rebuildTrayMenu();
  }
}

function formatInterval(seconds) {
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60} 分钟`;
  }
  return `${seconds} 秒`;
}
