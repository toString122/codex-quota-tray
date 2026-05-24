'use strict';

const elements = {
  fiveHourText: document.querySelector('#fiveHourText'),
  weeklyText: document.querySelector('#weeklyText'),
  statusBadge: document.querySelector('#statusBadge'),
  statusStrip: document.querySelector('#statusStrip')
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

  elements.fiveHourText.textContent = `${snapshot.pool.fiveHour.remainingPercent}%`;
  elements.weeklyText.textContent = `${snapshot.pool.weekly.remainingPercent}%`;
  elements.statusBadge.textContent =
    `${snapshot.pool.availableAccounts}/${snapshot.pool.totalAccounts}`;
}
