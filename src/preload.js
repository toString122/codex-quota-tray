'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexQuota', {
  getSnapshot: () => ipcRenderer.invoke('quota:get'),
  refresh: () => ipcRenderer.invoke('quota:refresh'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  previewConfig: (config) => ipcRenderer.invoke('config:preview', config),
  showPanel: () => ipcRenderer.invoke('window:show-panel'),
  hideStatusBar: () => ipcRenderer.invoke('statusbar:hide'),
  openApiUsage: () => ipcRenderer.invoke('link:open-api-usage'),
  onUpdate: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('quota:update', listener);
    return () => ipcRenderer.removeListener('quota:update', listener);
  },
  onConfigUpdate: (callback) => {
    const listener = (_event, config) => callback(config);
    ipcRenderer.on('config:update', listener);
    return () => ipcRenderer.removeListener('config:update', listener);
  }
});
