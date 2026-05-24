'use strict';

const elements = {
  shell: document.querySelector('.shell'),
  statusPill: document.querySelector('#statusPill'),
  statusText: document.querySelector('#statusText'),
  codexMeter: document.querySelector('#codexMeter'),
  codexPercent: document.querySelector('#codexPercent'),
  codexRemaining: document.querySelector('#codexRemaining'),
  codexReset: document.querySelector('#codexReset'),
  apiPercent: document.querySelector('#apiPercent'),
  apiBar: document.querySelector('#apiBar'),
  apiBudget: document.querySelector('#apiBudget'),
  codexUsed: document.querySelector('#codexUsed'),
  codexBar: document.querySelector('#codexBar'),
  codexLimit: document.querySelector('#codexLimit'),
  todayTokens: document.querySelector('#todayTokens'),
  todayTokensDetail: document.querySelector('#todayTokensDetail'),
  todayCost: document.querySelector('#todayCost'),
  todayCostDetail: document.querySelector('#todayCostDetail'),
  accountSummary: document.querySelector('#accountSummary'),
  accountList: document.querySelector('#accountList'),
  configPanel: document.querySelector('#configPanel'),
  configState: document.querySelector('#configState'),
  baseUrlInput: document.querySelector('#baseUrlInput'),
  managementKeyInput: document.querySelector('#managementKeyInput'),
  autoRefreshInput: document.querySelector('#autoRefreshInput'),
  usageStatsInput: document.querySelector('#usageStatsInput'),
  usagePollInput: document.querySelector('#usagePollInput'),
  refreshIntervalInput: document.querySelector('#refreshIntervalInput'),
  statusBarPositionInput: document.querySelector('#statusBarPositionInput'),
  languageInput: document.querySelector('#languageInput'),
  statusBarOpacityInput: document.querySelector('#statusBarOpacityInput'),
  opacityLabel: document.querySelector('#opacityLabel'),
  saveConfigButton: document.querySelector('#saveConfigButton'),
  configMessage: document.querySelector('#configMessage'),
  updatedAt: document.querySelector('#updatedAt'),
  eventList: document.querySelector('#eventList'),
  refreshButton: document.querySelector('#refreshButton'),
  openApiButton: document.querySelector('#openApiButton')
};

let activeLanguage = 'zh';
let activeConfig = {};

const translations = {
  zh: {
    normal: '正常',
    low: '偏低',
    critical: '紧张',
    configTitle: 'CLIProxyAPI 配置',
    baseUrl: 'Management API 地址',
    managementKey: '管理密钥',
    autoRefresh: '自动刷新',
    usageStats: '今日统计',
    usagePoll: '用量采集',
    refreshInterval: '刷新间隔（秒）',
    position: '状态条位置',
    language: '语言',
    topLeft: '左上方',
    topRight: '右上方',
    bottomLeft: '左下方',
    bottomRight: '右下方',
    saveAndRefresh: '保存并刷新',
    effective: '有效',
    poolTitle: 'Codex Plus 账号池',
    fiveHourPool: '5H 池',
    weekPool: 'Week 池',
    accountDetails: 'Plus 账号明细',
    refresh: '刷新',
    activity: '刷新记录',
    configured: '已配置',
    unconfigured: '未配置',
    keepKey: '留空保留当前密钥',
    firstKey: '首次配置必须填写',
    saving: '正在保存并刷新真实额度...',
    saved: '配置已保存。',
    saveFailed: '配置保存失败。',
    needConfig: '请先填写 CLIProxyAPI 地址和管理密钥。',
    configStored: '配置保存在本机 Electron userData 目录。',
    available: '可用账号',
    measured: '已测',
    bottleneck: '瓶颈',
    nextReset: 'Next reset',
    ready: '可用',
    limited: '受限',
    quotaUnknown: '额度未知',
    opacity: '背景透明度',
    todayTokens: '今日 Tokens',
    todayCost: '今日金额',
    usageStatsOff: '未开启今日统计',
    usageStatsOn: '每 30 秒读取 usage queue',
    estimated: '估算',
    requests: '请求',
    priced: '已计价',
    unknownModels: '未知模型'
  },
  en: {
    normal: 'Normal',
    low: 'Low',
    critical: 'Critical',
    configTitle: 'CLIProxyAPI Settings',
    baseUrl: 'Management API URL',
    managementKey: 'Management key',
    autoRefresh: 'Auto refresh',
    usageStats: 'Today stats',
    usagePoll: 'Usage poll',
    refreshInterval: 'Refresh interval (sec)',
    position: 'Status position',
    language: 'Language',
    topLeft: 'Top left',
    topRight: 'Top right',
    bottomLeft: 'Bottom left',
    bottomRight: 'Bottom right',
    saveAndRefresh: 'Save and refresh',
    effective: 'Effective',
    poolTitle: 'Codex Plus pool',
    fiveHourPool: '5H pool',
    weekPool: 'Week pool',
    accountDetails: 'Plus accounts',
    refresh: 'Refresh',
    activity: 'Refresh log',
    configured: 'Configured',
    unconfigured: 'Not configured',
    keepKey: 'Leave blank to keep current key',
    firstKey: 'Required on first setup',
    saving: 'Saving and refreshing real quota...',
    saved: 'Settings saved.',
    saveFailed: 'Failed to save settings.',
    needConfig: 'Enter CLIProxyAPI URL and management key first.',
    configStored: 'Settings are stored in Electron userData.',
    available: 'Available',
    measured: 'Measured',
    bottleneck: 'Limit',
    nextReset: 'Next reset',
    ready: 'ready',
    limited: 'limited',
    quotaUnknown: 'quota unknown',
    opacity: 'Background opacity',
    todayTokens: 'Today tokens',
    todayCost: 'Today cost',
    usageStatsOff: 'Today stats are off',
    usageStatsOn: 'Reads usage queue every 30 seconds',
    estimated: 'estimated',
    requests: 'requests',
    priced: 'priced',
    unknownModels: 'unknown models'
  }
};

window.codexQuota.onUpdate(render);
window.codexQuota.getSnapshot().then(render);
window.codexQuota.getConfig().then(renderConfig);
window.codexQuota.onConfigUpdate(renderConfig);

elements.refreshButton.addEventListener('click', async () => {
  render(await window.codexQuota.refresh());
});

elements.saveConfigButton.addEventListener('click', async () => {
  elements.saveConfigButton.disabled = true;
  elements.configMessage.textContent = t('saving');
  try {
    const result = await window.codexQuota.saveConfig({
      baseUrl: elements.baseUrlInput.value,
      managementKey: elements.managementKeyInput.value,
      autoRefreshEnabled: elements.autoRefreshInput.checked,
      usageStatsEnabled: elements.usageStatsInput.checked,
      refreshIntervalSeconds: elements.refreshIntervalInput.value,
      statusBarPosition: elements.statusBarPositionInput.value,
      statusBarOpacity: Number(elements.statusBarOpacityInput.value) / 100,
      language: elements.languageInput.value
    });
    elements.managementKeyInput.value = '';
    renderConfig(result.config);
    render(result.snapshot);
    elements.configMessage.textContent = t('saved');
  } catch (error) {
    elements.configMessage.textContent = error.message || t('saveFailed');
  } finally {
    elements.saveConfigButton.disabled = false;
  }
});

elements.languageInput.addEventListener('change', () => {
  activeLanguage = elements.languageInput.value === 'en' ? 'en' : 'zh';
  applyLanguage();
});

elements.statusBarOpacityInput.addEventListener('input', () => {
  updateOpacityLabel();
  void window.codexQuota.previewConfig({
    statusBarOpacity: Number(elements.statusBarOpacityInput.value) / 100
  });
});

elements.openApiButton.addEventListener('click', () => {
  window.codexQuota.openApiUsage();
});

function render(snapshot) {
  if (!snapshot) return;

  const statusClass = `status-${snapshot.status}`;
  document.body.classList.remove('status-good', 'status-warn', 'status-danger');
  document.body.classList.add(statusClass);

  elements.statusText.textContent = statusLabel(snapshot.status);
  elements.configPanel.classList.toggle('needs-config', !snapshot.configured);
  if (!snapshot.configured) {
    elements.configMessage.textContent = t('needConfig');
  } else if (snapshot.events[0]?.label === 'CLIProxyAPI refresh failed') {
    elements.configMessage.textContent = snapshot.events[0].detail;
  }

  elements.codexPercent.textContent = `${snapshot.pool.effectivePercent}%`;
  elements.codexMeter.style.setProperty(
    '--value',
    `${snapshot.pool.effectivePercent * 3.6}deg`
  );
  elements.codexRemaining.textContent =
    `5H ${snapshot.pool.fiveHour.remainingPercent}% / Week ${snapshot.pool.weekly.remainingPercent}%`;
  elements.codexReset.textContent =
    `${t('available')} ${snapshot.pool.availableAccounts}/${snapshot.pool.totalAccounts} · ${t('measured')} ${snapshot.pool.measuredAccounts}/${snapshot.pool.totalAccounts} · ${t('bottleneck')} ${snapshot.pool.bottleneck}`;

  elements.apiPercent.textContent = `${snapshot.pool.fiveHour.remainingPercent}%`;
  elements.apiBar.style.width = `${snapshot.pool.fiveHour.remainingPercent}%`;
  elements.apiBudget.textContent =
    `${t('nextReset')} ${formatMaybeTime(snapshot.pool.fiveHour.nextResetAt)}`;

  elements.codexUsed.textContent = `${snapshot.pool.weekly.remainingPercent}%`;
  elements.codexBar.style.width = `${snapshot.pool.weekly.remainingPercent}%`;
  elements.codexLimit.textContent =
    `${t('nextReset')} ${formatMaybeShortDate(snapshot.pool.weekly.nextResetAt)}`;
  renderUsage(snapshot.usage);

  elements.accountSummary.textContent =
    `${snapshot.pool.availableAccounts}/${snapshot.pool.totalAccounts} ready`;
  elements.accountList.replaceChildren(
    ...snapshot.accounts.map((account) => createAccountItem(account))
  );

  elements.updatedAt.textContent = formatClock(snapshot.updatedAt);
  elements.eventList.replaceChildren(
    ...snapshot.events.map((event) => createEventItem(event))
  );
}

function renderConfig(config) {
  if (!config) return;
  activeConfig = config;
  activeLanguage = config.language === 'en' ? 'en' : 'zh';
  elements.baseUrlInput.value = config.baseUrl || '';
  elements.autoRefreshInput.checked = config.autoRefreshEnabled !== false;
  elements.usageStatsInput.checked = config.usageStatsEnabled === true;
  elements.usagePollInput.value = '30 sec';
  elements.refreshIntervalInput.value = String(config.refreshIntervalSeconds || 300);
  elements.statusBarPositionInput.value = config.statusBarPosition || 'bottom-right';
  elements.languageInput.value = activeLanguage;
  elements.statusBarOpacityInput.value = String(
    Math.round((config.statusBarOpacity ?? 0.88) * 100)
  );
  elements.configPanel.classList.toggle('configured', config.hasManagementKey);
  applyLanguage();
  updateOpacityLabel();
}

function createAccountItem(account) {
  const item = document.createElement('li');
  item.className = 'account-row';

  const identity = document.createElement('div');
  const title = document.createElement('strong');
  const detail = document.createElement('span');
  const numbers = document.createElement('div');
  const fiveHour = document.createElement('span');
  const weekly = document.createElement('span');
  const effective = document.createElement('time');

  title.textContent = account.email;
  detail.textContent = account.quotaKnown
    ? `${account.plan.toUpperCase()} · ${account.available ? t('ready') : t('limited')}`
    : `${account.provider || 'codex'} · ${account.error || t('quotaUnknown')}`;
  fiveHour.textContent = `5H ${account.fiveHour.remainingPercent}%`;
  weekly.textContent = `Week ${account.weekly.remainingPercent}%`;
  effective.textContent = account.quotaKnown ? `${account.effectiveRemainingPercent}%` : '--';

  identity.append(title, detail);
  numbers.append(fiveHour, weekly, effective);
  item.append(identity, numbers);
  return item;
}

function renderUsage(usage) {
  if (!usage?.enabled) {
    elements.todayTokens.textContent = '--';
    elements.todayTokensDetail.textContent = t('usageStatsOff');
    elements.todayCost.textContent = '--';
    elements.todayCostDetail.textContent = t('usageStatsOn');
    return;
  }

  const today = usage.today || {};
  elements.todayTokens.textContent = formatTokens(today.totalTokens);
  elements.todayTokensDetail.textContent =
    `in ${formatTokens(today.inputTokens)} / out ${formatTokens(today.outputTokens)}`;
  elements.todayCost.textContent = formatUsd(today.estimatedUsd);
  elements.todayCostDetail.textContent =
    `${t('estimated')} · ${t('requests')} ${today.requestCount || 0} · ${t('priced')} ${today.pricedRequestCount || 0}/${today.requestCount || 0}`;

  if (usage.error) {
    elements.todayCostDetail.textContent = usage.error;
  } else if (today.unknownModelCount > 0) {
    elements.todayCostDetail.textContent += ` · ${t('unknownModels')} ${today.unknownModelCount}`;
  }
}

function applyLanguage() {
  document.documentElement.lang = activeLanguage === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  elements.managementKeyInput.placeholder = activeConfig.hasManagementKey
    ? t('keepKey')
    : t('firstKey');
  elements.configState.textContent = activeConfig.hasManagementKey
    ? t('configured')
    : t('unconfigured');
  updateOpacityLabel();
}

function updateOpacityLabel() {
  elements.opacityLabel.textContent =
    `${t('opacity')} ${elements.statusBarOpacityInput.value || 88}%`;
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

function statusLabel(status) {
  if (status === 'danger') return t('critical');
  if (status === 'warn') return t('low');
  return t('normal');
}

function t(key) {
  return translations[activeLanguage]?.[key] || translations.zh[key] || key;
}

function createEventItem(event) {
  const item = document.createElement('li');
  const copy = document.createElement('div');
  const title = document.createElement('strong');
  const detail = document.createElement('span');
  const time = document.createElement('time');

  title.textContent = event.label;
  detail.textContent = event.detail;
  time.textContent = formatClock(event.at);

  copy.append(title, detail);
  item.append(copy, time);
  return item;
}

function formatTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatMaybeTime(value) {
  return value ? formatTime(value) : '--';
}

function formatClock(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatMaybeShortDate(value) {
  return value ? formatShortDate(value) : '--';
}
