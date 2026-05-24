'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexQuota', {
  getSnapshot: () => ipcRenderer.invoke('quota:get'),
  refresh: () => ipcRenderer.invoke('quota:refresh'),
  consumeCodex: () => ipcRenderer.invoke('quota:consume-codex'),
  resetMock: () => ipcRenderer.invoke('quota:reset-mock'),
  showPanel: () => ipcRenderer.invoke('window:show-panel'),
  hideStatusBar: () => ipcRenderer.invoke('statusbar:hide'),
  openCodexUsage: () => ipcRenderer.invoke('link:open-codex-usage'),
  openApiUsage: () => ipcRenderer.invoke('link:open-api-usage'),
  onUpdate: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('quota:update', listener);
    return () => ipcRenderer.removeListener('quota:update', listener);
  }
});
