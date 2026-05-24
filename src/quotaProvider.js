'use strict';

const CHATGPT_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
const REQUEST_TIMEOUT_MS = 20000;

class CLIProxyAPIQuotaProvider {
  constructor(configStore) {
    this.configStore = configStore;
    this.snapshot = createEmptySnapshot({
      configured: configStore.getProviderConfig().configured,
      message: 'Waiting for CLIProxyAPI configuration'
    });
  }

  getSnapshot() {
    return this.snapshot;
  }

  async refresh() {
    const config = this.configStore.getProviderConfig();
    if (!config.configured) {
      this.snapshot = createEmptySnapshot({
        configured: false,
        message: 'Please configure CLIProxyAPI Management API'
      });
      return this.snapshot;
    }

    const now = Date.now();
    try {
      const authFiles = await this.fetchAuthFiles(config);
      const codexAccounts = authFiles.filter(isCodexAccount);
      const accounts = await Promise.all(
        codexAccounts.map((account) => this.fetchAccountQuota(config, account))
      );
      const pool = summarizePlusPool(accounts);

      this.snapshot = {
        source: 'cliproxyapi',
        configured: true,
        updatedAt: new Date(now).toISOString(),
        status: statusFor(pool.effectivePercent, pool),
        pool,
        accounts,
        codex: {
          label: 'ChatGPT Codex Plus Pool',
          limit: pool.measuredAccounts * 100,
          used: Math.round(pool.measuredAccounts * 100 - pool.effective.remainingUnits),
          remaining: Math.round(pool.effective.remainingUnits),
          percentRemaining: pool.effectivePercent,
          resetAt: pool.effective.nextResetAt
        },
        api: {
          label: 'CLIProxyAPI',
          budgetUsd: 0,
          spentUsd: 0,
          remainingUsd: 0,
          percentRemaining: pool.effectivePercent,
          resetAt: pool.weekly.nextResetAt
        },
        events: [
          {
            at: now,
            label: 'CLIProxyAPI refreshed',
            detail: `${pool.measuredAccounts}/${pool.totalAccounts} Codex accounts measured`
          }
        ]
      };
    } catch (error) {
      this.snapshot = createEmptySnapshot({
        configured: true,
        message: error.message || 'Failed to refresh CLIProxyAPI quota',
        previous: this.snapshot
      });
    }

    return this.snapshot;
  }

  async fetchAuthFiles(config) {
    const response = await managementFetch(config, '/v0/management/auth-files');
    if (!Array.isArray(response.files)) {
      throw new Error('CLIProxyAPI /auth-files returned no files array');
    }
    return response.files;
  }

  async fetchAccountQuota(config, account) {
    const base = accountFromAuthFile(account);

    if (!base.enabled) {
      return {
        ...base,
        quotaKnown: false,
        available: false,
        error: 'disabled or unavailable'
      };
    }

    try {
      const response = await managementFetch(config, '/v0/management/api-call', {
        method: 'POST',
        body: {
          auth_index: base.authIndex,
          method: 'GET',
          url: CHATGPT_USAGE_URL,
          header: {
            Authorization: 'Bearer $TOKEN$',
            Accept: 'application/json',
            'User-Agent': 'codex-cli'
          }
        }
      });

      if (response.status_code < 200 || response.status_code >= 300) {
        throw new Error(`usage request returned HTTP ${response.status_code}`);
      }

      const usage = JSON.parse(response.body || '{}');
      return {
        ...base,
        ...accountQuotaFromUsage(usage),
        rawPlan: usage.plan_type || ''
      };
    } catch (error) {
      return {
        ...base,
        quotaKnown: false,
        available: false,
        error: error.message || 'usage request failed'
      };
    }
  }
}

async function managementFetch(config, endpoint, options = {}) {
  const url = `${config.baseUrl}${endpoint}`;
  const init = {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${config.managementKey}`,
      'X-Management-Key': config.managementKey,
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  };

  if (options.body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`CLIProxyAPI returned non-JSON response from ${endpoint}`);
  }

  if (!response.ok) {
    throw new Error(data.error || `CLIProxyAPI ${endpoint} returned HTTP ${response.status}`);
  }

  return data;
}

function accountFromAuthFile(file) {
  const status = String(file.status || '').trim();
  const disabled = Boolean(file.disabled);
  const unavailable = Boolean(file.unavailable);

  return {
    authIndex: String(file.auth_index || file.authIndex || file.id || file.name || '').trim(),
    email: String(file.email || file.account || file.label || file.name || 'unknown').trim(),
    name: String(file.name || '').trim(),
    provider: String(file.provider || file.type || '').trim(),
    plan: 'plus',
    weight: 1,
    status: status || 'unknown',
    enabled: !disabled && !unavailable && status.toLowerCase() !== 'disabled',
    disabled,
    unavailable,
    quotaKnown: false,
    available: false,
    effectiveRemainingPercent: 0,
    fiveHour: emptyWindow(),
    weekly: emptyWindow()
  };
}

function accountQuotaFromUsage(usage) {
  const rateLimit = usage.rate_limit || {};
  const primary = rateLimit.primary_window || {};
  const secondary = rateLimit.secondary_window || {};
  const fiveHour = windowFromUsage(primary);
  const weekly = windowFromUsage(secondary);
  const allowed = Boolean(rateLimit.allowed);
  const limitReached = Boolean(rateLimit.limit_reached);
  const quotaKnown = fiveHour.known && weekly.known;
  const effectiveRemainingPercent = quotaKnown
    ? Math.min(fiveHour.remainingPercent, weekly.remainingPercent)
    : 0;

  return {
    allowed,
    limitReached,
    quotaKnown,
    available: quotaKnown && allowed && !limitReached && effectiveRemainingPercent > 0,
    effectiveRemainingPercent,
    fiveHour,
    weekly,
    creditsBalance: usage.credits?.balance ?? null
  };
}

function windowFromUsage(windowData) {
  const usedPercent = toNumber(windowData.used_percent);
  const known = Number.isFinite(usedPercent);
  const remainingPercent = known ? clamp(Math.round(100 - usedPercent), 0, 100) : 0;
  const resetAt = resetAtToIso(windowData.reset_at);

  return {
    known,
    usedPercent: known ? Math.round(usedPercent) : 0,
    remainingPercent,
    resetAt
  };
}

function summarizePlusPool(accounts) {
  const enabled = accounts.filter((account) => account.enabled);
  const measured = enabled.filter((account) => account.quotaKnown);
  const totalWeight = measured.reduce((sum, account) => sum + account.weight, 0) || 1;
  const fiveHourRemainingUnits = measured.reduce(
    (sum, account) => sum + account.weight * account.fiveHour.remainingPercent,
    0
  );
  const weeklyRemainingUnits = measured.reduce(
    (sum, account) => sum + account.weight * account.weekly.remainingPercent,
    0
  );
  const effectiveRemainingUnits = measured.reduce(
    (sum, account) => sum + account.weight * account.effectiveRemainingPercent,
    0
  );
  const fiveHourPercent = measured.length
    ? Math.round(fiveHourRemainingUnits / totalWeight)
    : 0;
  const weeklyPercent = measured.length
    ? Math.round(weeklyRemainingUnits / totalWeight)
    : 0;
  const effectivePercent = measured.length
    ? Math.round(effectiveRemainingUnits / totalWeight)
    : 0;

  return {
    plan: 'plus',
    totalAccounts: enabled.length,
    measuredAccounts: measured.length,
    availableAccounts: measured.filter((account) => account.available).length,
    effectivePercent,
    bottleneck: bottleneckForAccounts(measured),
    effective: {
      remainingUnits: effectiveRemainingUnits,
      capacityUnits: totalWeight * 100,
      remainingPercent: effectivePercent,
      nextResetAt: nextEffectiveReset(measured)
    },
    fiveHour: {
      remainingUnits: fiveHourRemainingUnits,
      capacityUnits: totalWeight * 100,
      remainingPercent: fiveHourPercent,
      nextResetAt: earliestReset(measured, 'fiveHour')
    },
    weekly: {
      remainingUnits: weeklyRemainingUnits,
      capacityUnits: totalWeight * 100,
      remainingPercent: weeklyPercent,
      nextResetAt: earliestReset(measured, 'weekly')
    }
  };
}

function bottleneckForAccounts(accounts) {
  let fiveHourLimited = 0;
  let weeklyLimited = 0;

  for (const account of accounts) {
    if (account.fiveHour.remainingPercent < account.weekly.remainingPercent) {
      fiveHourLimited += 1;
    } else if (account.weekly.remainingPercent < account.fiveHour.remainingPercent) {
      weeklyLimited += 1;
    }
  }

  if (fiveHourLimited > 0 && weeklyLimited > 0) return 'Mixed';
  if (fiveHourLimited > 0) return '5H';
  if (weeklyLimited > 0) return 'Week';
  return accounts.length ? 'Even' : 'None';
}

function nextEffectiveReset(accounts) {
  const limitedResets = accounts
    .map((account) => {
      if (account.fiveHour.remainingPercent <= account.weekly.remainingPercent) {
        return account.fiveHour.resetAt;
      }
      return account.weekly.resetAt;
    })
    .filter(Boolean)
    .sort();

  return limitedResets[0] || null;
}

function isCodexAccount(file) {
  const provider = String(file.provider || file.type || '').toLowerCase();
  const name = String(file.name || file.id || '').toLowerCase();
  return provider === 'codex' || name.startsWith('codex-') || Boolean(file.id_token);
}

function createEmptySnapshot({ configured, message, previous } = {}) {
  const now = Date.now();
  const pool = {
    plan: 'plus',
    totalAccounts: 0,
    measuredAccounts: 0,
    availableAccounts: 0,
    effectivePercent: 0,
    bottleneck: '5H',
    effective: {
      remainingUnits: 0,
      capacityUnits: 0,
      remainingPercent: 0,
      nextResetAt: null
    },
    fiveHour: {
      remainingUnits: 0,
      capacityUnits: 0,
      remainingPercent: 0,
      nextResetAt: null
    },
    weekly: {
      remainingUnits: 0,
      capacityUnits: 0,
      remainingPercent: 0,
      nextResetAt: null
    }
  };

  return {
    source: 'cliproxyapi',
    configured: Boolean(configured),
    updatedAt: new Date(now).toISOString(),
    status: configured ? 'warn' : 'danger',
    pool,
    accounts: [],
    codex: {
      label: 'ChatGPT Codex Plus Pool',
      limit: 0,
      used: 0,
      remaining: 0,
      percentRemaining: 0,
      resetAt: null
    },
    api: {
      label: 'CLIProxyAPI',
      budgetUsd: 0,
      spentUsd: 0,
      remainingUsd: 0,
      percentRemaining: 0,
      resetAt: null
    },
    events: [
      {
        at: now,
        label: configured ? 'CLIProxyAPI refresh failed' : 'Configuration required',
        detail: message || 'No quota data available'
      }
    ],
    previous: previous?.configured ? previous.updatedAt : null
  };
}

function earliestReset(accounts, windowName) {
  const values = accounts
    .map((account) => account[windowName].resetAt)
    .filter(Boolean)
    .sort();
  return values[0] || null;
}

function resetAtToIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const timestamp = number > 10_000_000_000 ? number : number * 1000;
  return new Date(timestamp).toISOString();
}

function emptyWindow() {
  return {
    known: false,
    usedPercent: 0,
    remainingPercent: 0,
    resetAt: null
  };
}

function statusFor(percent, pool) {
  if (!pool || pool.measuredAccounts === 0) return 'warn';
  if (percent <= 12) return 'danger';
  if (percent <= 30) return 'warn';
  return 'good';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return Number.NaN;
  return Number(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  CLIProxyAPIQuotaProvider,
  managementFetch
};
