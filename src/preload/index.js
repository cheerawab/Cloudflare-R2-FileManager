import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
    listBuckets: (credentials) => ipcRenderer.invoke('r2:listBuckets', credentials),
    listFiles: (args) => ipcRenderer.invoke('r2:listFiles', args),
    uploadFile: (args) => ipcRenderer.invoke('r2:uploadFile', args),
    deleteFile: (args) => ipcRenderer.invoke('r2:deleteFile', args),
    downloadFile: (args) => ipcRenderer.invoke('r2:downloadFile', args),
    openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
    // Auth
    saveCredentials: (creds) => ipcRenderer.invoke('auth:saveCredentials', creds),
    getCredentials: () => ipcRenderer.invoke('auth:getCredentials'),
    deleteCredentials: () => ipcRenderer.invoke('auth:deleteCredentials')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    window.electron = electronAPI
    window.api = api
}
