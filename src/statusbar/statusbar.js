'use strict';

const elements = {
  fiveHourText: document.querySelector('#fiveHourText'),
  weeklyText: document.querySelector('#weeklyText'),
  statusBadge: document.querySelector('#statusBadge'),
  statusStrip: document.querySelector('#statusStrip')
};

let activeConfig = {
  language: 'zh',
  statusBarOpacity: 0.88
};

window.codexQuota.onUpdate(render);
window.codexQuota.getSnapshot().then(render);
window.codexQuota.getConfig().then(renderConfig);
window.codexQuota.onConfigUpdate(renderConfig);

elements.statusStrip.addEventListener('click', () => {
  window.codexQuota.showPanel();
});

function render(snapshot) {
  if (!snapshot) return;

  document.body.classList.remove('status-good', 'status-warn', 'status-danger');
  document.body.classList.add(`status-${snapshot.status}`);

  if (!snapshot.configured) {
    elements.fiveHourText.textContent = activeConfig.language === 'en' ? 'URL' : '地址';
    elements.weeklyText.textContent = activeConfig.language === 'en' ? 'Key' : '密钥';
    elements.statusBadge.textContent = 'SET';
    return;
  }

  elements.fiveHourText.textContent = `${snapshot.pool.fiveHour.remainingPercent}%`;
  elements.weeklyText.textContent = `${snapshot.pool.weekly.remainingPercent}%`;
  elements.statusBadge.textContent =
    `${snapshot.pool.availableAccounts}/${snapshot.pool.totalAccounts}`;
}

function renderConfig(config) {
  if (!config) return;
  activeConfig = {
    ...activeConfig,
    ...config
  };
  const opacity = normalizeOpacity(activeConfig.statusBarOpacity);
  const style = document.documentElement.style;
  document.documentElement.lang = activeConfig.language === 'en' ? 'en' : 'zh-CN';
  style.setProperty('--surface-alpha', formatAlpha(opacity));
  style.setProperty('--surface-highlight-alpha', formatAlpha(opacity * 0.1));
  style.setProperty('--surface-border-alpha', formatAlpha(opacity * 0.16));
  style.setProperty('--surface-hover-border-alpha', formatAlpha(opacity * 0.28));
  style.setProperty('--badge-bg-alpha', formatAlpha(opacity * 0.14));
  style.setProperty('--badge-border-alpha', formatAlpha(opacity * 0.16));
}

function normalizeOpacity(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0.88;
  return Math.min(Math.max(parsed, 0.2), 1);
}

function formatAlpha(value) {
  return String(Number(value.toFixed(3)));
}
