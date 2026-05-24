'use strict';

class MockQuotaProvider {
  constructor() {
    this.startedAt = Date.now();
    this.codexLimit = 160;
    this.codexUsedBase = 61;
    this.apiBudgetUsd = 25;
    this.apiSpentBaseUsd = 8.42;
    this.events = [
      {
        at: Date.now() - 1000 * 60 * 4,
        label: '模拟任务完成',
        detail: '-3 Codex'
      },
      {
        at: Date.now() - 1000 * 60 * 17,
        label: '后台刷新',
        detail: 'API 成本同步'
      }
    ];
  }

  getSnapshot() {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - this.startedAt) / 1000);
    const codexDrift = Math.floor(elapsedSeconds / 35);
    const apiDrift = elapsedSeconds * 0.0027;

    const codexUsed = clamp(this.codexUsedBase + codexDrift, 0, this.codexLimit);
    const codexRemaining = this.codexLimit - codexUsed;
    const codexPercent = Math.round((codexRemaining / this.codexLimit) * 100);

    const apiSpent = roundMoney(
      clamp(this.apiSpentBaseUsd + apiDrift, 0, this.apiBudgetUsd)
    );
    const apiRemaining = roundMoney(this.apiBudgetUsd - apiSpent);
    const apiPercent = Math.round((apiRemaining / this.apiBudgetUsd) * 100);

    return {
      source: 'mock',
      updatedAt: new Date(now).toISOString(),
      status: statusFor(Math.min(codexPercent, apiPercent)),
      codex: {
        label: 'ChatGPT Codex',
        limit: this.codexLimit,
        used: codexUsed,
        remaining: codexRemaining,
        percentRemaining: codexPercent,
        resetAt: new Date(now + 1000 * 60 * 60 * 9 + 1000 * 60 * 18).toISOString()
      },
      api: {
        label: 'OpenAI API',
        budgetUsd: this.apiBudgetUsd,
        spentUsd: apiSpent,
        remainingUsd: apiRemaining,
        percentRemaining: apiPercent,
        resetAt: nextMonthStart(now).toISOString()
      },
      events: this.events.slice(0, 5)
    };
  }

  consumeCodex(amount = 7) {
    this.codexUsedBase = clamp(this.codexUsedBase + amount, 0, this.codexLimit);
    this.events.unshift({
      at: Date.now(),
      label: '模拟消耗',
      detail: `-${amount} Codex`
    });
  }

  reset() {
    this.startedAt = Date.now();
    this.codexUsedBase = 61;
    this.apiSpentBaseUsd = 8.42;
    this.events.unshift({
      at: Date.now(),
      label: '模拟重置',
      detail: '额度恢复到初始值'
    });
  }

  refresh() {
    this.events.unshift({
      at: Date.now(),
      label: '手动刷新',
      detail: '读取 mock provider'
    });
  }
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

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  MockQuotaProvider
};
