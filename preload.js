const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    generateUniverse: (apiKey, useQpu) => ipcRenderer.invoke('generate-universe', apiKey, useQpu),
    loadUniverseData: () => ipcRenderer.invoke('load-universe-data'),
    closeApp: () => ipcRenderer.send('close-app')
});
