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
  elements.codexPercent.textContent = `${snapshot.codex.percentRemaining}%`;
  elements.codexMeter.style.setProperty(
    '--value',
    `${snapshot.codex.percentRemaining * 3.6}deg`
  );
  elements.codexRemaining.textContent = `${snapshot.codex.remaining} / ${snapshot.codex.limit}`;
  elements.codexReset.textContent = `Reset ${formatTime(snapshot.codex.resetAt)}`;

  elements.apiPercent.textContent = `${snapshot.api.percentRemaining}%`;
  elements.apiBar.style.width = `${snapshot.api.percentRemaining}%`;
  elements.apiBudget.textContent =
    `$${snapshot.api.remainingUsd.toFixed(2)} left / $${snapshot.api.budgetUsd.toFixed(2)}`;

  const usedPercent = Math.round((snapshot.codex.used / snapshot.codex.limit) * 100);
  elements.codexUsed.textContent = `${snapshot.codex.used}`;
  elements.codexBar.style.width = `${usedPercent}%`;
  elements.codexLimit.textContent = `Limit ${snapshot.codex.limit}`;

  elements.updatedAt.textContent = formatClock(snapshot.updatedAt);
  elements.eventList.replaceChildren(
    ...snapshot.events.map((event) => createEventItem(event))
  );
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
