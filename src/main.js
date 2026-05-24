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
const { CLIProxyAPIQuotaProvider, managementFetch } = require('./quotaProvider');
const { createQuotaTrayImage } = require('./trayIcon');
const { UsageStatsStore } = require('./usageStatsStore');

let configStore = null;
let provider = null;
let usageStatsStore = null;
let tray = null;
let window = null;
let statusBarWindow = null;
let snapshot = null;
let refreshTimer = null;
let usageStatsTimer = null;
let refreshInFlight = false;
let usageStatsInFlight = false;
let usageStatsRuntime = {
  telemetryEnabled: null,
  lastPollAt: null,
  error: ''
};
let notifiedStatus = 'good';
let statusBarVisible = true;

const STATUS_BAR_SIZE = {
  width: 186,
  height: 34
};
const USAGE_STATS_POLL_INTERVAL_MS = 30_000;
const USAGE_QUEUE_COUNT = 500;

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
    usageStatsStore = new UsageStatsStore(app.getPath('userData'));
    provider = new CLIProxyAPIQuotaProvider(configStore);
    snapshot = attachUsageStats(provider.getSnapshot());
    createTray();
    createWindow();
    createStatusBarWindow();
    if (!snapshot.configured) {
      showWindow();
    }
    void updateQuota('startup');
    scheduleAutoRefresh();
    scheduleUsageStatsPolling();
    screen.on('display-metrics-changed', positionStatusBar);
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  if (refreshTimer) clearInterval(refreshTimer);
  if (usageStatsTimer) clearInterval(usageStatsTimer);
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
    statusBarWindow.webContents.send('config:update', configStore.getPublicConfig());
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
    snapshot = attachUsageStats(await provider.refresh());
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
  snapshot = attachUsageStats(snapshot);

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
    statusBarWindow.webContents.send('config:update', configStore.getPublicConfig());
    if (statusBarVisible) {
      positionStatusBar();
    }
  }
}

function rebuildTrayMenu() {
  const publicConfig = configStore.getPublicConfig();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `5H ${t('remaining')} ${snapshot.pool.fiveHour.remainingPercent}%`,
      enabled: false
    },
    {
      label: `Week ${t('remaining')} ${snapshot.pool.weekly.remainingPercent}%`,
      enabled: false
    },
    {
      label: `${t('availableAccounts')} ${snapshot.pool.availableAccounts}/${snapshot.pool.totalAccounts}`,
      enabled: false
    },
    ...(publicConfig.usageStatsEnabled
      ? [
          {
            label: `${t('todayUsage')}: ${formatTokens(snapshot.usage.today.totalTokens)} / ${formatUsd(snapshot.usage.today.estimatedUsd)}`,
            enabled: false
          }
        ]
      : []),
    {
      label: publicConfig.autoRefreshEnabled
        ? `${t('autoRefresh')}: ${formatInterval(publicConfig.refreshIntervalSeconds)}`
        : `${t('autoRefresh')}: ${t('off')}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: t('showPanel'),
      click: showWindow
    },
    {
      label: t('configureCliProxyApi'),
      click: showWindow
    },
    {
      label: statusBarVisible ? t('hideStatusText') : t('showStatusText'),
      type: 'checkbox',
      checked: statusBarVisible,
      click: (menuItem) => setStatusBarVisible(menuItem.checked)
    },
    {
      label: t('refreshQuota'),
      click: () => {
        void updateQuota('manual');
      }
    },
    { type: 'separator' },
    {
      label: t('openCliProxyApi'),
      click: () => shell.openExternal(configStore.getPublicConfig().baseUrl)
    },
    { type: 'separator' },
    {
      label: t('quit'),
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
    statusBarWindow.webContents.send('config:update', configStore.getPublicConfig());
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
  const position = configStore.getPublicConfig().statusBarPosition;
  const left = display.workArea.x + margin;
  const right = display.workArea.x + display.workArea.width - STATUS_BAR_SIZE.width - margin;
  const top = display.workArea.y + margin;
  const bottom = display.workArea.y + display.workArea.height - STATUS_BAR_SIZE.height - margin;
  const x = position.endsWith('left') ? left : right;
  const y = position.startsWith('top') ? top : bottom;

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
      title: t('quotaNotificationTitle'),
      body: `${t('effectiveQuota')} ${nextSnapshot.pool.effectivePercent}%`
    }).show();
  }
}

function formatTooltip(nextSnapshot) {
  if (!nextSnapshot.configured) {
    return [
      t('notConfigured'),
      t('configureHint')
    ].join('\n');
  }

  return [
    `${t('effectiveQuota')} ${nextSnapshot.pool.effectivePercent}%`,
    `5H: ${nextSnapshot.pool.fiveHour.remainingPercent}% | Week: ${nextSnapshot.pool.weekly.remainingPercent}%`,
    `${t('availableAccounts')}: ${nextSnapshot.pool.availableAccounts}/${nextSnapshot.pool.totalAccounts}`
  ].join('\n');
}

function getTrayPercent(nextSnapshot) {
  return nextSnapshot?.pool?.effectivePercent ?? nextSnapshot?.codex?.percentRemaining ?? 0;
}

ipcMain.handle('quota:get', () => attachUsageStats(snapshot));

ipcMain.handle('quota:refresh', () => {
  return updateQuota('manual');
});

ipcMain.handle('config:get', () => {
  return configStore.getPublicConfig();
});

ipcMain.handle('config:save', async (_event, nextConfig) => {
  configStore.save(nextConfig || {});
  scheduleAutoRefresh();
  scheduleUsageStatsPolling();
  broadcastConfig();
  positionStatusBar();
  await updateQuota('config');
  await refreshUsageStats('config');
  return {
    config: configStore.getPublicConfig(),
    snapshot
  };
});

ipcMain.handle('config:preview', (_event, nextConfig) => {
  const previewConfig = {
    ...configStore.getPublicConfig()
  };

  if (
    Object.prototype.hasOwnProperty.call(nextConfig || {}, 'statusBarOpacity')
  ) {
    previewConfig.statusBarOpacity = normalizePreviewOpacity(
      nextConfig.statusBarOpacity
    );
  }

  if (statusBarWindow && !statusBarWindow.isDestroyed()) {
    statusBarWindow.webContents.send('config:update', previewConfig);
  }

  return previewConfig;
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

function scheduleUsageStatsPolling() {
  if (usageStatsTimer) {
    clearInterval(usageStatsTimer);
    usageStatsTimer = null;
  }

  const publicConfig = configStore.getPublicConfig();
  if (!publicConfig.usageStatsEnabled || !publicConfig.hasManagementKey) {
    usageStatsRuntime = {
      telemetryEnabled: null,
      lastPollAt: null,
      error: ''
    };
    snapshot = attachUsageStats(snapshot);
    return;
  }

  usageStatsTimer = setInterval(() => {
    void refreshUsageStats('timer');
  }, USAGE_STATS_POLL_INTERVAL_MS);
  void refreshUsageStats('startup');
}

async function refreshUsageStats(reason) {
  if (usageStatsInFlight) return snapshot?.usage || null;

  const config = configStore.getProviderConfig();
  if (!config.configured || !config.usageStatsEnabled) {
    snapshot = attachUsageStats(snapshot);
    return snapshot?.usage || null;
  }

  usageStatsInFlight = true;
  try {
    await ensureUsageStatisticsEnabled(config);
    const response = await managementFetch(
      config,
      `/v0/management/usage-queue?count=${USAGE_QUEUE_COUNT}`
    );
    const records = usageRecordsFromQueueResponse(response);
    const added = usageStatsStore.ingest(records);

    usageStatsRuntime = {
      telemetryEnabled: true,
      lastPollAt: new Date().toISOString(),
      error: ''
    };
    snapshot = attachUsageStats(snapshot);

    if (added > 0 || reason !== 'timer') {
      renderSnapshot();
    }

    return snapshot.usage;
  } catch (error) {
    usageStatsRuntime = {
      ...usageStatsRuntime,
      lastPollAt: new Date().toISOString(),
      error: error.message || 'Failed to refresh usage statistics'
    };
    snapshot = attachUsageStats(snapshot);
    renderSnapshot();
    return snapshot.usage;
  } finally {
    usageStatsInFlight = false;
  }
}

async function ensureUsageStatisticsEnabled(config) {
  const response = await managementFetch(
    config,
    '/v0/management/usage-statistics-enabled'
  );
  const enabled = Boolean(
    response['usage-statistics-enabled'] ?? response.enabled ?? response.value
  );
  usageStatsRuntime.telemetryEnabled = enabled;

  if (!enabled) {
    await managementFetch(config, '/v0/management/usage-statistics-enabled', {
      method: 'PUT',
      body: {
        value: true
      }
    });
    usageStatsRuntime.telemetryEnabled = true;
  }
}

function usageRecordsFromQueueResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.queue)) return response.queue;
  if (Array.isArray(response.records)) return response.records;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.usage_queue)) return response.usage_queue;
  if (Array.isArray(response.usage_entries)) return response.usage_entries;
  if (Array.isArray(response.usages)) return response.usages;
  return [];
}

function attachUsageStats(nextSnapshot) {
  if (!nextSnapshot || !usageStatsStore || !configStore) return nextSnapshot;
  return {
    ...nextSnapshot,
    usage: usageStatsStore.getTodaySnapshot({
      enabled: configStore.getPublicConfig().usageStatsEnabled,
      ...usageStatsRuntime
    })
  };
}

function broadcastConfig() {
  const publicConfig = configStore.getPublicConfig();
  if (window && !window.isDestroyed()) {
    window.webContents.send('config:update', publicConfig);
  }
  if (statusBarWindow && !statusBarWindow.isDestroyed()) {
    statusBarWindow.webContents.send('config:update', publicConfig);
  }
}

function formatInterval(seconds) {
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60} ${t('minutes')}`;
  }
  return `${seconds} ${t('seconds')}`;
}

function formatTokens(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '0';
  if (number >= 1_000_000) return `${trimNumber(number / 1_000_000)}M`;
  if (number >= 1_000) return `${trimNumber(number / 1_000)}K`;
  return String(Math.round(number));
}

function formatUsd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '$--';
  if (number > 0 && number < 0.01) return '$<0.01';
  return `$${number.toFixed(2)}`;
}

function trimNumber(value) {
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

function normalizePreviewOpacity(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0.88;
  return Math.min(Math.max(parsed, 0), 1);
}

function t(key) {
  const language = configStore?.getPublicConfig().language === 'en' ? 'en' : 'zh';
  const dictionary = {
    zh: {
      remaining: '池剩余',
      availableAccounts: '可用账号',
      todayUsage: '今日用量',
      autoRefresh: '自动刷新',
      off: '关闭',
      showPanel: '显示状态面板',
      configureCliProxyApi: '配置 CLIProxyAPI',
      hideStatusText: '隐藏常驻文字',
      showStatusText: '显示常驻文字',
      refreshQuota: '刷新真实额度',
      openCliProxyApi: '打开 CLIProxyAPI',
      quit: '退出',
      quotaNotificationTitle: 'Codex 余量提醒',
      effectiveQuota: 'Codex Plus 账号池有效余量',
      notConfigured: 'CLIProxyAPI 未配置',
      configureHint: '打开状态面板填写 API 地址和管理密钥',
      minutes: '分钟',
      seconds: '秒'
    },
    en: {
      remaining: 'remaining',
      availableAccounts: 'Available accounts',
      todayUsage: 'Today usage',
      autoRefresh: 'Auto refresh',
      off: 'off',
      showPanel: 'Show panel',
      configureCliProxyApi: 'Configure CLIProxyAPI',
      hideStatusText: 'Hide status text',
      showStatusText: 'Show status text',
      refreshQuota: 'Refresh quota',
      openCliProxyApi: 'Open CLIProxyAPI',
      quit: 'Quit',
      quotaNotificationTitle: 'Codex quota alert',
      effectiveQuota: 'Codex Plus pool effective quota',
      notConfigured: 'CLIProxyAPI is not configured',
      configureHint: 'Open the panel and enter API URL and management key',
      minutes: 'min',
      seconds: 'sec'
    }
  };
  return dictionary[language][key] || dictionary.zh[key] || key;
}
