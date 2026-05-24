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
  accountSummary: document.querySelector('#accountSummary'),
  accountList: document.querySelector('#accountList'),
  configPanel: document.querySelector('#configPanel'),
  configState: document.querySelector('#configState'),
  baseUrlInput: document.querySelector('#baseUrlInput'),
  managementKeyInput: document.querySelector('#managementKeyInput'),
  autoRefreshInput: document.querySelector('#autoRefreshInput'),
  refreshIntervalInput: document.querySelector('#refreshIntervalInput'),
  saveConfigButton: document.querySelector('#saveConfigButton'),
  configMessage: document.querySelector('#configMessage'),
  updatedAt: document.querySelector('#updatedAt'),
  eventList: document.querySelector('#eventList'),
  refreshButton: document.querySelector('#refreshButton'),
  openApiButton: document.querySelector('#openApiButton')
};

const statusLabels = {
  good: 'Normal',
  warn: 'Low',
  danger: 'Critical'
};

window.codexQuota.onUpdate(render);
window.codexQuota.getSnapshot().then(render);
window.codexQuota.getConfig().then(renderConfig);

elements.refreshButton.addEventListener('click', async () => {
  render(await window.codexQuota.refresh());
});

elements.saveConfigButton.addEventListener('click', async () => {
  elements.saveConfigButton.disabled = true;
  elements.configMessage.textContent = '正在保存并刷新真实额度...';
  try {
    const result = await window.codexQuota.saveConfig({
      baseUrl: elements.baseUrlInput.value,
      managementKey: elements.managementKeyInput.value,
      autoRefreshEnabled: elements.autoRefreshInput.checked,
      refreshIntervalSeconds: elements.refreshIntervalInput.value
    });
    elements.managementKeyInput.value = '';
    renderConfig(result.config);
    render(result.snapshot);
    elements.configMessage.textContent = '配置已保存。';
  } catch (error) {
    elements.configMessage.textContent = error.message || '配置保存失败。';
  } finally {
    elements.saveConfigButton.disabled = false;
  }
});

elements.openApiButton.addEventListener('click', () => {
  window.codexQuota.openApiUsage();
});

function render(snapshot) {
  if (!snapshot) return;

  const statusClass = `status-${snapshot.status}`;
  document.body.classList.remove('status-good', 'status-warn', 'status-danger');
  document.body.classList.add(statusClass);

  elements.statusText.textContent = statusLabels[snapshot.status] || 'Normal';
  elements.configPanel.classList.toggle('needs-config', !snapshot.configured);
  if (!snapshot.configured) {
    elements.configMessage.textContent = '请先填写 CLIProxyAPI 地址和管理密钥。';
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
    `可用账号 ${snapshot.pool.availableAccounts}/${snapshot.pool.totalAccounts} · 已测 ${snapshot.pool.measuredAccounts}/${snapshot.pool.totalAccounts} · 瓶颈 ${snapshot.pool.bottleneck}`;

  elements.apiPercent.textContent = `${snapshot.pool.fiveHour.remainingPercent}%`;
  elements.apiBar.style.width = `${snapshot.pool.fiveHour.remainingPercent}%`;
  elements.apiBudget.textContent =
    `Next reset ${formatMaybeTime(snapshot.pool.fiveHour.nextResetAt)}`;

  elements.codexUsed.textContent = `${snapshot.pool.weekly.remainingPercent}%`;
  elements.codexBar.style.width = `${snapshot.pool.weekly.remainingPercent}%`;
  elements.codexLimit.textContent =
    `Next reset ${formatMaybeShortDate(snapshot.pool.weekly.nextResetAt)}`;

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
  elements.baseUrlInput.value = config.baseUrl || '';
  elements.managementKeyInput.placeholder = config.hasManagementKey
    ? '留空保留当前密钥'
    : '首次配置必须填写';
  elements.autoRefreshInput.checked = config.autoRefreshEnabled !== false;
  elements.refreshIntervalInput.value = String(config.refreshIntervalSeconds || 300);
  elements.configState.textContent = config.hasManagementKey ? '已配置' : '未配置';
  elements.configPanel.classList.toggle('configured', config.hasManagementKey);
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
    ? `${account.plan.toUpperCase()} · ${account.available ? 'ready' : 'limited'}`
    : `${account.provider || 'codex'} · ${account.error || 'quota unknown'}`;
  fiveHour.textContent = `5H ${account.fiveHour.remainingPercent}%`;
  weekly.textContent = `Week ${account.weekly.remainingPercent}%`;
  effective.textContent = account.quotaKnown ? `${account.effectiveRemainingPercent}%` : '--';

  identity.append(title, detail);
  numbers.append(fiveHour, weekly, effective);
  item.append(identity, numbers);
  return item;
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
