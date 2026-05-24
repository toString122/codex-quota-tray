'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STATS_FILE = 'usage-stats.json';
const MAX_DAYS_TO_KEEP = 14;

const MODEL_PRICE_RULES = [
  {
    pattern: /gpt-5.*nano/i,
    inputUsdPerMillion: 0.05,
    cachedInputUsdPerMillion: 0.005,
    outputUsdPerMillion: 0.4
  },
  {
    pattern: /gpt-5.*mini/i,
    inputUsdPerMillion: 0.25,
    cachedInputUsdPerMillion: 0.025,
    outputUsdPerMillion: 2
  },
  {
    pattern: /gpt-5/i,
    inputUsdPerMillion: 1.25,
    cachedInputUsdPerMillion: 0.125,
    outputUsdPerMillion: 10
  },
  {
    pattern: /gpt-4\.1.*mini/i,
    inputUsdPerMillion: 0.4,
    cachedInputUsdPerMillion: 0.1,
    outputUsdPerMillion: 1.6
  },
  {
    pattern: /gpt-4\.1/i,
    inputUsdPerMillion: 2,
    cachedInputUsdPerMillion: 0.5,
    outputUsdPerMillion: 8
  },
  {
    pattern: /gpt-4o.*mini/i,
    inputUsdPerMillion: 0.15,
    cachedInputUsdPerMillion: 0.075,
    outputUsdPerMillion: 0.6
  },
  {
    pattern: /gpt-4o/i,
    inputUsdPerMillion: 2.5,
    cachedInputUsdPerMillion: 1.25,
    outputUsdPerMillion: 10
  }
];

class UsageStatsStore {
  constructor(userDataPath) {
    this.statsPath = path.join(userDataPath, STATS_FILE);
    this.state = this.readState();
  }

  ingest(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return 0;
    }

    let added = 0;
    for (const record of records) {
      if (!record || typeof record !== 'object') continue;
      if (this.addRecord(record)) {
        added += 1;
      }
    }

    if (added > 0) {
      this.prune();
      this.save();
    }

    return added;
  }

  getTodaySnapshot(options = {}) {
    const dateKey = localDateKey(new Date());
    const summary = normalizeDaySummary(
      this.state.days[dateKey] || createEmptyDaySummary(dateKey)
    );

    return {
      enabled: Boolean(options.enabled),
      telemetryEnabled: options.telemetryEnabled ?? null,
      lastPollAt: options.lastPollAt || null,
      error: options.error || '',
      today: publicDaySummary(summary)
    };
  }

  addRecord(record) {
    const dateKey = localDateKey(parseRecordDate(record.timestamp));
    const summary = normalizeDaySummary(
      this.state.days[dateKey] || createEmptyDaySummary(dateKey)
    );
    const recordId = recordIdentifier(record);
    if (recordId && summary.seenIds.includes(recordId)) {
      return false;
    }

    const tokens = tokensFromRecord(record);
    const cost = estimateRecordCost(record, tokens);

    if (recordId) {
      summary.seenIds.push(recordId);
      if (summary.seenIds.length > 10_000) {
        summary.seenIds.splice(0, summary.seenIds.length - 10_000);
      }
    }
    summary.requestCount += 1;
    if (record.failed) summary.failedCount += 1;
    summary.totalTokens += tokens.totalTokens;
    summary.inputTokens += tokens.inputTokens;
    summary.outputTokens += tokens.outputTokens;
    summary.reasoningTokens += tokens.reasoningTokens;
    summary.cachedTokens += tokens.cachedTokens;
    summary.estimatedUsd += cost.estimatedUsd;
    summary.pricedRequestCount += cost.priceKnown ? 1 : 0;
    summary.unknownModelCount += cost.priceKnown ? 0 : 1;
    summary.lastRecordAt = latestIso(summary.lastRecordAt, record.timestamp);

    this.state.days[dateKey] = summary;
    return true;
  }

  readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.statsPath, 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.days) {
        return {
          version: 1,
          days: parsed.days
        };
      }
    } catch {
      // Empty or missing stats file is normal on first run.
    }

    return {
      version: 1,
      days: {}
    };
  }

  save() {
    fs.mkdirSync(path.dirname(this.statsPath), { recursive: true });
    fs.writeFileSync(this.statsPath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  prune() {
    const keys = Object.keys(this.state.days).sort();
    while (keys.length > MAX_DAYS_TO_KEEP) {
      const key = keys.shift();
      delete this.state.days[key];
    }
  }
}

function tokensFromRecord(record) {
  const tokens = record.tokens || {};
  const inputTokens = toNonNegativeInteger(tokens.input_tokens);
  const outputTokens = toNonNegativeInteger(tokens.output_tokens);
  const reasoningTokens = toNonNegativeInteger(tokens.reasoning_tokens);
  const cachedTokens = toNonNegativeInteger(tokens.cached_tokens);
  const totalTokens = toNonNegativeInteger(tokens.total_tokens) ||
    inputTokens + outputTokens + reasoningTokens;

  return {
    totalTokens,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedTokens
  };
}

function estimateRecordCost(record, tokens) {
  const model = String(record.model || record.alias || '').trim();
  const price = priceForModel(model);

  if (!price) {
    return {
      estimatedUsd: 0,
      priceKnown: false
    };
  }

  const billableInputTokens = Math.max(tokens.inputTokens - tokens.cachedTokens, 0);
  const billableOutputTokens = outputTokensForBilling(tokens);
  const estimatedUsd =
    (billableInputTokens / 1_000_000) * price.inputUsdPerMillion +
    (tokens.cachedTokens / 1_000_000) * price.cachedInputUsdPerMillion +
    (billableOutputTokens / 1_000_000) * price.outputUsdPerMillion;

  return {
    estimatedUsd,
    priceKnown: true
  };
}

function outputTokensForBilling(tokens) {
  const explicitSum =
    tokens.inputTokens + tokens.outputTokens + tokens.reasoningTokens;
  if (tokens.reasoningTokens > 0 && explicitSum === tokens.totalTokens) {
    return tokens.outputTokens + tokens.reasoningTokens;
  }
  return tokens.outputTokens;
}

function priceForModel(model) {
  return MODEL_PRICE_RULES.find((rule) => rule.pattern.test(model)) || null;
}

function publicDaySummary(summary) {
  return {
    date: summary.date,
    requestCount: summary.requestCount,
    failedCount: summary.failedCount,
    totalTokens: summary.totalTokens,
    inputTokens: summary.inputTokens,
    outputTokens: summary.outputTokens,
    reasoningTokens: summary.reasoningTokens,
    cachedTokens: summary.cachedTokens,
    estimatedUsd: Number(summary.estimatedUsd.toFixed(6)),
    pricedRequestCount: summary.pricedRequestCount,
    unknownModelCount: summary.unknownModelCount,
    lastRecordAt: summary.lastRecordAt
  };
}

function normalizeDaySummary(summary) {
  return {
    date: summary.date || localDateKey(new Date()),
    requestCount: toNonNegativeInteger(summary.requestCount),
    failedCount: toNonNegativeInteger(summary.failedCount),
    totalTokens: toNonNegativeInteger(summary.totalTokens),
    inputTokens: toNonNegativeInteger(summary.inputTokens),
    outputTokens: toNonNegativeInteger(summary.outputTokens),
    reasoningTokens: toNonNegativeInteger(summary.reasoningTokens),
    cachedTokens: toNonNegativeInteger(summary.cachedTokens),
    estimatedUsd: toFiniteNumber(summary.estimatedUsd),
    pricedRequestCount: toNonNegativeInteger(summary.pricedRequestCount),
    unknownModelCount: toNonNegativeInteger(summary.unknownModelCount),
    lastRecordAt: summary.lastRecordAt || null,
    seenIds: Array.isArray(summary.seenIds) ? summary.seenIds : []
  };
}

function createEmptyDaySummary(date) {
  return {
    date,
    requestCount: 0,
    failedCount: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedTokens: 0,
    estimatedUsd: 0,
    pricedRequestCount: 0,
    unknownModelCount: 0,
    lastRecordAt: null,
    seenIds: []
  };
}

function parseRecordDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function latestIso(current, next) {
  const currentTime = new Date(current || 0).getTime();
  const nextDate = parseRecordDate(next);
  return nextDate.getTime() > currentTime ? nextDate.toISOString() : current || null;
}

function recordIdentifier(record) {
  const explicitId =
    record.id ||
    record.request_id ||
    record.requestId ||
    record.message_id ||
    record.messageId;
  if (explicitId) return String(explicitId);
  if (!record.timestamp || !record.model) return '';
  return [
    record.timestamp,
    record.provider || '',
    record.auth_index || '',
    record.model || '',
    record.tokens?.total_tokens || ''
  ].join('|');
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number);
}

function toFiniteNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return number;
}

module.exports = {
  UsageStatsStore
};
