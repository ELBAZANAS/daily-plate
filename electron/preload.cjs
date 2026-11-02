const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dailyPlate', {
  readLabel(bytes) {
    return ipcRenderer.invoke('read-label', bytes)
  },
  saveBackup(json) {
    return ipcRenderer.invoke('save-backup', json)
  },
  openBackups() {
    return ipcRenderer.invoke('open-backups')
  },
})
