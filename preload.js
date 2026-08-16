const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    generateUniverse: (apiKey, useQpu) => ipcRenderer.invoke('generate-universe', apiKey, useQpu),
    closeApp: () => ipcRenderer.send('close-app')
});
