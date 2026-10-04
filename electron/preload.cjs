const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  apps: () => ipcRenderer.invoke('apps:list'),
  openCode: data => ipcRenderer.invoke('code:open', data),
  settings: () => ipcRenderer.invoke('settings:get'),
  configure: data => ipcRenderer.invoke('settings:save', data),
  token: () => ipcRenderer.invoke('speech:token'),
  generate: data => ipcRenderer.invoke('draft:generate', data),
  cancel: () => ipcRenderer.send('draft:cancel'),
  save: data => ipcRenderer.invoke('file:save', data),
  load: () => ipcRenderer.invoke('draft:load'),
  autosave: data => ipcRenderer.invoke('draft:save', data),
  onChunk: callback => { const listener = (_, value) => callback(value); ipcRenderer.on('draft:chunk', listener); return () => ipcRenderer.removeListener('draft:chunk', listener); },
});
