// PC Bastos Harvest Management System
// Electron Preload IPC Bridge

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getTerminalConfig: () => ipcRenderer.invoke('terminal:get-config'),
  saveTerminalConfig: (config) => ipcRenderer.invoke('terminal:save-config', config),
  printReceipt: (options) => ipcRenderer.invoke('print:receipt', options),
  onSyncTrigger: (callback) => ipcRenderer.on('sync:trigger', () => callback()),
  notifyOfflineSave: (data) => ipcRenderer.send('offline:saved', data)
});
