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
  updatedAt: document.querySelector('#updatedAt'),
  eventList: document.querySelector('#eventList'),
  refreshButton: document.querySelector('#refreshButton'),
  consumeButton: document.querySelector('#consumeButton'),
  resetButton: document.querySelector('#resetButton'),
  openCodexButton: document.querySelector('#openCodexButton'),
  openApiButton: document.querySelector('#openApiButton')
};

const statusLabels = {
  good: 'Normal',
  warn: 'Low',
  danger: 'Critical'
};

window.codexQuota.onUpdate(render);
window.codexQuota.getSnapshot().then(render);

elements.refreshButton.addEventListener('click', async () => {
  render(await window.codexQuota.refresh());
});

elements.consumeButton.addEventListener('click', async () => {
  render(await window.codexQuota.consumeCodex());
});

elements.resetButton.addEventListener('click', async () => {
  render(await window.codexQuota.resetMock());
});

elements.openCodexButton.addEventListener('click', () => {
  window.codexQuota.openCodexUsage();
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
  elements.codexPercent.textContent = `${snapshot.pool.effectivePercent}%`;
  elements.codexMeter.style.setProperty(
    '--value',
    `${snapshot.pool.effectivePercent * 3.6}deg`
  );
  elements.codexRemaining.textContent =
    `5H ${snapshot.pool.fiveHour.remainingPercent}% / 周 ${snapshot.pool.weekly.remainingPercent}%`;
  elements.codexReset.textContent =
    `可用账号 ${snapshot.pool.availableAccounts}/${snapshot.pool.totalAccounts} · 瓶颈 ${snapshot.pool.bottleneck}`;

  elements.apiPercent.textContent = `${snapshot.pool.fiveHour.remainingPercent}%`;
  elements.apiBar.style.width = `${snapshot.pool.fiveHour.remainingPercent}%`;
  elements.apiBudget.textContent =
    `Next reset ${formatTime(snapshot.pool.fiveHour.nextResetAt)}`;

  elements.codexUsed.textContent = `${snapshot.pool.weekly.remainingPercent}%`;
  elements.codexBar.style.width = `${snapshot.pool.weekly.remainingPercent}%`;
  elements.codexLimit.textContent =
    `Next reset ${formatShortDate(snapshot.pool.weekly.nextResetAt)}`;

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
  detail.textContent = `${account.plan.toUpperCase()} · ${account.available ? 'ready' : 'limited'}`;
  fiveHour.textContent = `5H ${account.fiveHour.remainingPercent}%`;
  weekly.textContent = `周 ${account.weekly.remainingPercent}%`;
  effective.textContent = `${account.effectiveRemainingPercent}%`;

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
