import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlayAPI', {
  onSetScreenshot: (callback: (data: any) => void) => {
    ipcRenderer.on('set-screenshot', (_event, data) => callback(data));
  },
  sendResult: (resultChannel: string, result: any) => {
    ipcRenderer.invoke(resultChannel, result);
  },
});
