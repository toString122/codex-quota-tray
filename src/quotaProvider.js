'use strict';

const FIVE_HOUR_MS = 1000 * 60 * 60 * 5;
const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

class MockQuotaProvider {
  constructor() {
    this.startedAt = Date.now();
    this.accounts = [
      createAccount('plus-01', 'alpha@example.com', 39, 28, 2.1),
      createAccount('plus-02', 'bravo@example.com', 54, 64, 1.5),
      createAccount('plus-03', 'charlie@example.com', 12, 18, 2.8),
      createAccount('plus-04', 'delta@example.com', 86, 41, 1.1),
      createAccount('plus-05', 'echo@example.com', 22, 79, 2.4)
    ];
    this.events = [
      {
        at: Date.now() - 1000 * 60 * 4,
        label: '账号池汇总',
        detail: '5 个 Plus 账号等权计算'
      },
      {
        at: Date.now() - 1000 * 60 * 17,
        label: '后台刷新',
        detail: '读取 mock provider'
      }
    ];
  }

  getSnapshot() {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - this.startedAt) / 1000);
    const accountSnapshots = this.accounts.map((account, index) =>
      snapshotAccount(account, index, now, elapsedSeconds)
    );
    const pool = summarizePlusPool(accountSnapshots);

    return {
      source: 'mock',
      updatedAt: new Date(now).toISOString(),
      status: statusFor(pool.effectivePercent),
      pool,
      accounts: accountSnapshots,
      codex: {
        label: 'ChatGPT Codex Plus Pool',
        limit: pool.totalAccounts * 100,
        used: Math.round(pool.totalAccounts * 100 - pool.fiveHour.remainingUnits),
        remaining: Math.round(pool.fiveHour.remainingUnits),
        percentRemaining: pool.fiveHour.remainingPercent,
        resetAt: pool.fiveHour.nextResetAt
      },
      api: {
        label: 'OpenAI API',
        budgetUsd: 25,
        spentUsd: 0,
        remainingUsd: 25,
        percentRemaining: 100,
        resetAt: nextMonthStart(now).toISOString()
      },
      events: this.events.slice(0, 5)
    };
  }

  consumeCodex(amount = 7) {
    const snapshot = this.getSnapshot();
    const best = snapshot.accounts
      .filter((account) => account.available)
      .sort((a, b) => b.effectiveRemainingPercent - a.effectiveRemainingPercent)[0];

    if (!best) return;

    const account = this.accounts.find((item) => item.authIndex === best.authIndex);
    account.fiveHourUsedBase = clamp(account.fiveHourUsedBase + amount, 0, 100);
    account.weeklyUsedBase = clamp(account.weeklyUsedBase + amount * 0.35, 0, 100);

    this.events.unshift({
      at: Date.now(),
      label: '模拟消耗',
      detail: `${account.email} -${amount}% 5H`
    });
  }

  reset() {
    this.startedAt = Date.now();
    this.accounts = [
      createAccount('plus-01', 'alpha@example.com', 39, 28, 2.1),
      createAccount('plus-02', 'bravo@example.com', 54, 64, 1.5),
      createAccount('plus-03', 'charlie@example.com', 12, 18, 2.8),
      createAccount('plus-04', 'delta@example.com', 86, 41, 1.1),
      createAccount('plus-05', 'echo@example.com', 22, 79, 2.4)
    ];
    this.events.unshift({
      at: Date.now(),
      label: '模拟重置',
      detail: 'Plus 账号池恢复到初始值'
    });
  }

  refresh() {
    this.events.unshift({
      at: Date.now(),
      label: '手动刷新',
      detail: '重新汇总所有 Plus 账号'
    });
  }
}

function createAccount(authIndex, email, fiveHourUsedBase, weeklyUsedBase, driftFactor) {
  return {
    authIndex,
    email,
    plan: 'plus',
    enabled: true,
    status: 'ready',
    weight: 1,
    fiveHourUsedBase,
    weeklyUsedBase,
    driftFactor,
    fiveHourWindowStartedAt: Date.now() - 1000 * 60 * (40 + fiveHourUsedBase),
    weeklyWindowStartedAt: Date.now() - 1000 * 60 * 60 * (8 + weeklyUsedBase)
  };
}

function snapshotAccount(account, index, now, elapsedSeconds) {
  const fiveHourUsedPercent = clamp(
    account.fiveHourUsedBase + Math.floor(elapsedSeconds / (45 + index * 8)) * account.driftFactor,
    0,
    100
  );
  const weeklyUsedPercent = clamp(
    account.weeklyUsedBase + elapsedSeconds * 0.0014 * account.driftFactor,
    0,
    100
  );
  const fiveHourRemainingPercent = Math.round(100 - fiveHourUsedPercent);
  const weeklyRemainingPercent = Math.round(100 - weeklyUsedPercent);
  const effectiveRemainingPercent = Math.min(
    fiveHourRemainingPercent,
    weeklyRemainingPercent
  );
  const available =
    account.enabled &&
    account.status === 'ready' &&
    fiveHourRemainingPercent > 0 &&
    weeklyRemainingPercent > 0;

  return {
    authIndex: account.authIndex,
    email: account.email,
    plan: account.plan,
    weight: account.weight,
    status: account.status,
    enabled: account.enabled,
    available,
    effectiveRemainingPercent,
    fiveHour: {
      usedPercent: Math.round(fiveHourUsedPercent),
      remainingPercent: fiveHourRemainingPercent,
      resetAt: new Date(account.fiveHourWindowStartedAt + FIVE_HOUR_MS).toISOString()
    },
    weekly: {
      usedPercent: Math.round(weeklyUsedPercent),
      remainingPercent: weeklyRemainingPercent,
      resetAt: new Date(account.weeklyWindowStartedAt + WEEK_MS).toISOString()
    }
  };
}

function summarizePlusPool(accounts) {
  const included = accounts.filter((account) => account.enabled);
  const totalWeight = included.reduce((sum, account) => sum + account.weight, 0) || 1;
  const fiveHourRemainingUnits = included.reduce(
    (sum, account) => sum + account.weight * account.fiveHour.remainingPercent,
    0
  );
  const weeklyRemainingUnits = included.reduce(
    (sum, account) => sum + account.weight * account.weekly.remainingPercent,
    0
  );
  const fiveHourPercent = Math.round(fiveHourRemainingUnits / totalWeight);
  const weeklyPercent = Math.round(weeklyRemainingUnits / totalWeight);
  const effectivePercent = Math.min(fiveHourPercent, weeklyPercent);

  return {
    plan: 'plus',
    totalAccounts: included.length,
    availableAccounts: included.filter((account) => account.available).length,
    effectivePercent,
    bottleneck: fiveHourPercent <= weeklyPercent ? '5H' : '周',
    fiveHour: {
      remainingUnits: fiveHourRemainingUnits,
      capacityUnits: totalWeight * 100,
      remainingPercent: fiveHourPercent,
      nextResetAt: earliestReset(included, 'fiveHour')
    },
    weekly: {
      remainingUnits: weeklyRemainingUnits,
      capacityUnits: totalWeight * 100,
      remainingPercent: weeklyPercent,
      nextResetAt: earliestReset(included, 'weekly')
    }
  };
}

function earliestReset(accounts, windowName) {
  return accounts
    .map((account) => account[windowName].resetAt)
    .sort()[0];
}

function statusFor(percent) {
  if (percent <= 12) return 'danger';
  if (percent <= 30) return 'warn';
  return 'good';
}

function nextMonthStart(timestamp) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  MockQuotaProvider
};
