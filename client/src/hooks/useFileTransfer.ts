import { useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { CHUNK_SIZE, CHUNK_THRESHOLD } from '@shared/schema';

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

  // Read a specific chunk of a file as base64
  const readFileChunk = useCallback((file: File, chunkIndex: number, chunkSize: number = CHUNK_SIZE): Promise<string> => {
    return new Promise((resolve, reject) => {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const reader = new FileReader();
      reader.onload = () => {
        // Convert ArrayBuffer to base64
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        resolve(btoa(binary));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(chunk);
    });
  }, []);

  // Check if a file should use chunked transfer
  const shouldUseChunkedTransfer = useCallback((file: File): boolean => {
    return file.size > CHUNK_THRESHOLD;
  }, []);

  // Calculate total number of chunks for a file
  const getTotalChunks = useCallback((fileSize: number, chunkSize: number = CHUNK_SIZE): number => {
    return Math.ceil(fileSize / chunkSize);
  }, []);

  // Generate a unique transfer ID
  const generateTransferId = useCallback((): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  return {
    uploadFile,
    syncClipboard,
    downloadFile,
    readFileAsText,
    readFileAsDataURL,
    readFileChunk,
    shouldUseChunkedTransfer,
    getTotalChunks,
    generateTransferId,
    CHUNK_SIZE,
    CHUNK_THRESHOLD,
  };
}
