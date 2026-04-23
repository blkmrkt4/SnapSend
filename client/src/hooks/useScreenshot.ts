import { useState, useCallback, useEffect } from 'react';
import type { ScreenshotResult, WindowSource, DisplayInfo } from '@/types/electron';

interface ScreenshotData {
  dataURL: string;
  width: number;
  height: number;
}

interface UseScreenshotOptions {
  onSendFile: (fileData: any) => void;
  onShowMist?: () => void;
}

export function useScreenshot({ onSendFile, onShowMist }: UseScreenshotOptions) {
  const [showScreenshotPicker, setShowScreenshotPicker] = useState(false);
  const [screenshotData, setScreenshotData] = useState<ScreenshotData | null>(null);
  const [windowSources, setWindowSources] = useState<WindowSource[] | null>(null);
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo[] | null>(null);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [platform, setPlatform] = useState<string>('');

  const isElectron = !!window.electronAPI?.isElectron;
  const isMultiMonitor = (displayInfo?.length ?? 0) > 1;
  const isMac = platform === 'darwin';

  useEffect(() => {
    window.electronAPI?.getPlatform?.().then(setPlatform).catch(() => {});
  }, []);

  // Load display info on mount (Electron only)
  const loadDisplayInfo = useCallback(async () => {
    if (window.electronAPI?.getDisplayInfo) {
      const info = await window.electronAPI.getDisplayInfo();
      setDisplayInfo(info);
    }
  }, []);

  useEffect(() => {
    loadDisplayInfo();
  }, [loadDisplayInfo]);

  // Send captured screenshot through the file pipeline
  const sendScreenshot = useCallback(async (dataURL: string) => {
    const filename = `screenshot-${Date.now()}.png`;
    const base64Data = dataURL.split(',')[1];
    const sizeInBytes = base64Data ? Math.round(base64Data.length * 0.75) : 0;

    await onSendFile({
      filename,
      originalName: filename,
      mimeType: 'image/png',
      size: sizeInBytes,
      content: dataURL,
      isClipboard: false,
    });
    onShowMist?.();
  }, [onSendFile, onShowMist]);

  // Handle ScreenshotResult with error checking
  const handleResult = useCallback(async (result: ScreenshotResult | null) => {
    if (!result) return; // Cancelled or failed

    if ('error' in result && result.error === 'permission') {
      setPermissionDialogOpen(true);
      return;
    }

    if ('error' in result) return; // Other errors (cancelled)

    if (result.dataURL) {
      await sendScreenshot(result.dataURL);
    }
  }, [sendScreenshot]);

  // --- Browser fallback ---
  const captureBrowser = useCallback(async (surfaceHint?: string): Promise<ScreenshotData | null> => {
    if (!navigator.mediaDevices?.getDisplayMedia) return null;
    try {
      const constraints: any = { video: true };
      if (surfaceHint) {
        constraints.video = { displaySurface: surfaceHint };
      }
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        video.addEventListener('loadedmetadata', () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0);
          stream.getTracks().forEach(track => track.stop());
          setTimeout(() => window.focus(), 100);
          resolve({
            dataURL: canvas.toDataURL('image/png'),
            width: video.videoWidth,
            height: video.videoHeight,
          });
        });
      });
    } catch {
      return null;
    }
  }, []);

  // --- Select Area ---
  const handleScreenshotSelectArea = useCallback(async () => {
    setShowScreenshotPicker(false);

    if (isElectron && window.electronAPI?.screenshotSelectArea) {
      const result = await window.electronAPI.screenshotSelectArea();
      await handleResult(result);
      return;
    }

    // Browser fallback: capture full screen, show ScreenshotCropper
    const result = await captureBrowser('monitor');
    if (result) {
      setScreenshotData(result);
    }
  }, [isElectron, handleResult, captureBrowser]);

  // --- Window capture ---
  const handleScreenshotWindow = useCallback(async () => {
    setShowScreenshotPicker(false);

    if (isElectron) {
      // macOS: native window picker — returns ScreenshotResult directly
      if (window.electronAPI?.screenshotWindowNative) {
        const result = await window.electronAPI.screenshotWindowNative();
        // On macOS, result is ScreenshotResult. On Windows, result is null (use list flow).
        if (result !== null) {
          await handleResult(result);
          return;
        }
      }

      // Windows: get window list for thumbnail picker
      if (window.electronAPI?.screenshotListWindows) {
        const sources = await window.electronAPI.screenshotListWindows();
        if (sources.length > 0) {
          setWindowSources(sources);
          return;
        }
      }
    }

    // Browser fallback
    const result = await captureBrowser('window');
    if (result) await sendScreenshot(result.dataURL);
  }, [isElectron, handleResult, captureBrowser, sendScreenshot]);

  // Windows: user selected a window from the thumbnail picker
  const handleWindowSourceSelect = useCallback(async (source: WindowSource) => {
    setWindowSources(null);
    // Use the pre-fetched full-res data directly — no refetch needed
    await sendScreenshot(source.fullResDataURL);
  }, [sendScreenshot]);

  // --- Full screen capture ---
  const handleScreenshotFullScreen = useCallback(async (displayId?: number | string) => {
    setShowScreenshotPicker(false);

    if (isElectron && window.electronAPI?.screenshotFullscreen) {
      const result = await window.electronAPI.screenshotFullscreen(displayId);
      await handleResult(result);
      return;
    }

    // Browser fallback
    const result = await captureBrowser('monitor');
    if (result) await sendScreenshot(result.dataURL);
  }, [isElectron, handleResult, captureBrowser, sendScreenshot]);

  // --- Cropper callbacks (browser mode only) ---
  const handleScreenshotCrop = useCallback(async (croppedDataURL: string) => {
    setScreenshotData(null);
    await sendScreenshot(croppedDataURL);
  }, [sendScreenshot]);

  const handleScreenshotCancel = useCallback(() => {
    setScreenshotData(null);
    setWindowSources(null);
  }, []);

  return {
    showScreenshotPicker,
    setShowScreenshotPicker,
    screenshotData,
    windowSources,
    displayInfo,
    isMultiMonitor,
    permissionDialogOpen,
    setPermissionDialogOpen,
    isMac,
    handleScreenshotSelectArea,
    handleScreenshotWindow,
    handleScreenshotFullScreen,
    handleScreenshotCrop,
    handleScreenshotCancel,
    handleWindowSourceSelect,
  };
}
