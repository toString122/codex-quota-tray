'use strict';

const elements = {
  codexText: document.querySelector('#codexText'),
  apiText: document.querySelector('#apiText'),
  statusBadge: document.querySelector('#statusBadge'),
  statusStrip: document.querySelector('#statusStrip')
};

const statusLabels = {
  good: 'OK',
  warn: 'LOW',
  danger: 'HOT'
};

window.codexQuota.onUpdate(render);
window.codexQuota.getSnapshot().then(render);

elements.statusStrip.addEventListener('click', () => {
  window.codexQuota.showPanel();
});

function render(snapshot) {
  if (!snapshot) return;

  document.body.classList.remove('status-good', 'status-warn', 'status-danger');
  document.body.classList.add(`status-${snapshot.status}`);

  elements.codexText.textContent =
    `${snapshot.codex.remaining}/${snapshot.codex.limit} (${snapshot.codex.percentRemaining}%)`;
  elements.apiText.textContent =
    `$${snapshot.api.remainingUsd.toFixed(2)} / $${snapshot.api.budgetUsd.toFixed(2)}`;
  elements.statusBadge.textContent = statusLabels[snapshot.status] || 'OK';
}
