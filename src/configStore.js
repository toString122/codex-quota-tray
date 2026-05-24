'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { safeStorage } = require('electron');

const CONFIG_FILE = 'config.json';
const DEFAULT_BASE_URL = 'http://127.0.0.1:8317';

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
      )
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
      configured: Boolean(baseUrl && managementKey)
    };
  }

  save(nextConfig) {
    const baseUrl = normalizeBaseUrl(nextConfig.baseUrl || DEFAULT_BASE_URL);
    const managementKey = String(nextConfig.managementKey || '').trim();

    this.config.baseUrl = baseUrl;
    if (managementKey) {
      this.setManagementKey(managementKey);
    }

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
}

function normalizeBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

module.exports = {
  ConfigStore,
  DEFAULT_BASE_URL
};
