import { useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

export function useFileTransfer() {
  const uploadFile = useCallback(async (file: File, deviceId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (deviceId) {
      formData.append('deviceId', deviceId.toString());
    }

    const response = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    return response.json();
  }, []);

  const syncClipboard = useCallback(async (content: string, deviceId?: number) => {
    return apiRequest('POST', '/api/clipboard', {
      content,
      deviceId,
    });
  }, []);

  const downloadFile = useCallback(async (fileId: number) => {
    const response = await fetch(`/api/files/${fileId}/download`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to download file');
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition');
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
      : 'download';

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, []);

  const readFileAsText = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }, []);

  const readFileAsDataURL = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  return {
    uploadFile,
    syncClipboard,
    downloadFile,
    readFileAsText,
    readFileAsDataURL,
  };
}
