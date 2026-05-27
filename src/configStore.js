'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { safeStorage } = require('electron');

const CONFIG_FILE = 'config.json';
const DEFAULT_BASE_URL = 'http://127.0.0.1:8317';
const DEFAULT_AUTO_REFRESH_ENABLED = true;
const DEFAULT_REFRESH_INTERVAL_SECONDS = 300;
const MIN_REFRESH_INTERVAL_SECONDS = 60;
const MAX_REFRESH_INTERVAL_SECONDS = 3600;
const DEFAULT_LANGUAGE = 'zh';
const DEFAULT_STATUS_BAR_POSITION = 'bottom-right';
const DEFAULT_STATUS_BAR_OPACITY = 0.88;
const DEFAULT_USAGE_STATS_ENABLED = false;
const DEFAULT_AUTO_LAUNCH_ENABLED = false;

class ConfigStore {
  constructor(userDataPath) {
    this.configPath = path.join(userDataPath, CONFIG_FILE);
    this.config = this.readConfig();
  }

  getPublicConfig() {
    return {
      baseUrl: this.config.baseUrl || process.env.CLIPROXYAPI_BASE_URL || DEFAULT_BASE_URL,
      hasManagementKey: Boolean(
        this.getManagementKey() || process.env.CLIPROXYAPI_MANAGEMENT_KEY
      ),
      autoRefreshEnabled: this.getAutoRefreshEnabled(),
      autoLaunchEnabled: this.getAutoLaunchEnabled(),
      refreshIntervalSeconds: this.getRefreshIntervalSeconds(),
      usageStatsEnabled: this.getUsageStatsEnabled(),
      language: this.getLanguage(),
      statusBarPosition: this.getStatusBarPosition(),
      statusBarBounds: this.getStatusBarBounds(),
      statusBarOpacity: this.getStatusBarOpacity()
    };
  }

  getProviderConfig() {
    const baseUrl = normalizeBaseUrl(
      this.config.baseUrl || process.env.CLIPROXYAPI_BASE_URL || DEFAULT_BASE_URL
    );
    const managementKey =
      this.getManagementKey() || process.env.CLIPROXYAPI_MANAGEMENT_KEY || '';

    return {
      baseUrl,
      managementKey,
      autoRefreshEnabled: this.getAutoRefreshEnabled(),
      autoLaunchEnabled: this.getAutoLaunchEnabled(),
      refreshIntervalSeconds: this.getRefreshIntervalSeconds(),
      usageStatsEnabled: this.getUsageStatsEnabled(),
      language: this.getLanguage(),
      statusBarPosition: this.getStatusBarPosition(),
      statusBarBounds: this.getStatusBarBounds(),
      statusBarOpacity: this.getStatusBarOpacity(),
      configured: Boolean(baseUrl && managementKey)
    };
  }

  save(nextConfig) {
    const baseUrl = normalizeBaseUrl(nextConfig.baseUrl || DEFAULT_BASE_URL);
    const managementKey = String(nextConfig.managementKey || '').trim();
    const previousStatusBarPosition = this.getStatusBarPosition();
    const nextStatusBarPosition = normalizeStatusBarPosition(
      nextConfig.statusBarPosition
    );

    this.config.baseUrl = baseUrl;
    this.config.autoRefreshEnabled = nextConfig.autoRefreshEnabled !== false;
    this.config.autoLaunchEnabled = nextConfig.autoLaunchEnabled === true;
    this.config.refreshIntervalSeconds = normalizeRefreshInterval(
      nextConfig.refreshIntervalSeconds
    );
    this.config.usageStatsEnabled = nextConfig.usageStatsEnabled === true;
    this.config.language = normalizeLanguage(nextConfig.language);
    this.config.statusBarPosition = nextStatusBarPosition;
    if (nextStatusBarPosition !== previousStatusBarPosition) {
      delete this.config.statusBarBounds;
    }
    this.config.statusBarOpacity = normalizeStatusBarOpacity(
      nextConfig.statusBarOpacity
    );
    if (managementKey) {
      this.setManagementKey(managementKey);
    }

    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  saveStatusBarBounds(bounds) {
    const normalized = normalizeStatusBarBounds(bounds);
    if (!normalized) return;

    this.config.statusBarBounds = normalized;
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  readConfig() {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch {
      return {};
    }
  }

  getManagementKey() {
    if (this.config.managementKeyEncrypted) {
      try {
        return safeStorage.decryptString(
          Buffer.from(this.config.managementKeyEncrypted, 'base64')
        );
      } catch {
        return '';
      }
    }

    return String(this.config.managementKey || '').trim();
  }

  setManagementKey(value) {
    if (safeStorage.isEncryptionAvailable()) {
      this.config.managementKeyEncrypted = safeStorage
        .encryptString(value)
        .toString('base64');
      delete this.config.managementKey;
      return;
    }

    this.config.managementKey = value;
    delete this.config.managementKeyEncrypted;
  }

  getAutoRefreshEnabled() {
    if (typeof this.config.autoRefreshEnabled === 'boolean') {
      return this.config.autoRefreshEnabled;
    }
    return DEFAULT_AUTO_REFRESH_ENABLED;
  }

  getAutoLaunchEnabled() {
    if (typeof this.config.autoLaunchEnabled === 'boolean') {
      return this.config.autoLaunchEnabled;
    }
    return DEFAULT_AUTO_LAUNCH_ENABLED;
  }

  getRefreshIntervalSeconds() {
    return normalizeRefreshInterval(this.config.refreshIntervalSeconds);
  }

  getUsageStatsEnabled() {
    if (typeof this.config.usageStatsEnabled === 'boolean') {
      return this.config.usageStatsEnabled;
    }
    return DEFAULT_USAGE_STATS_ENABLED;
  }

  getLanguage() {
    return normalizeLanguage(this.config.language);
  }

  getStatusBarPosition() {
    return normalizeStatusBarPosition(this.config.statusBarPosition);
  }

  getStatusBarBounds() {
    return normalizeStatusBarBounds(this.config.statusBarBounds);
  }

  getStatusBarOpacity() {
    return normalizeStatusBarOpacity(this.config.statusBarOpacity);
  }
}

function normalizeBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

function normalizeRefreshInterval(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_REFRESH_INTERVAL_SECONDS;
  return Math.min(
    Math.max(parsed, MIN_REFRESH_INTERVAL_SECONDS),
    MAX_REFRESH_INTERVAL_SECONDS
  );
}

function normalizeLanguage(value) {
  return value === 'en' ? 'en' : DEFAULT_LANGUAGE;
}

function normalizeStatusBarPosition(value) {
  const normalized = String(value || '').trim();
  if (
    normalized === 'top-left' ||
    normalized === 'top-right' ||
    normalized === 'bottom-left' ||
    normalized === 'bottom-right'
  ) {
    return normalized;
  }
  return DEFAULT_STATUS_BAR_POSITION;
}

function normalizeStatusBarBounds(value) {
  if (!value || typeof value !== 'object') return null;

  const x = Number.parseInt(value.x, 10);
  const y = Number.parseInt(value.y, 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return {
    x,
    y
  };
}

function normalizeStatusBarOpacity(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return DEFAULT_STATUS_BAR_OPACITY;
  return Math.min(Math.max(parsed, 0), 1);
}

module.exports = {
  ConfigStore,
  DEFAULT_BASE_URL,
  DEFAULT_REFRESH_INTERVAL_SECONDS,
  MIN_REFRESH_INTERVAL_SECONDS,
  DEFAULT_USAGE_STATS_ENABLED,
  DEFAULT_AUTO_LAUNCH_ENABLED,
  DEFAULT_LANGUAGE,
  DEFAULT_STATUS_BAR_POSITION,
  DEFAULT_STATUS_BAR_OPACITY
};
