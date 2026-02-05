import { useState, useRef, useCallback, useEffect } from 'react';

interface ScreenshotCropperProps {
  imageDataURL: string;
  imageWidth: number;
  imageHeight: number;
  onCrop: (croppedDataURL: string) => void;
  onCancel: () => void;
}

export function ScreenshotCropper({
  imageDataURL,
  imageWidth,
  imageHeight,
  onCrop,
  onCancel,
}: ScreenshotCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [end, setEnd] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);

  useEffect(() => {
    const img = new Image();
    img.src = imageDataURL;
    img.onload = () => {
      imgRef.current = img;
      drawCanvas(img);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageDataURL, onCancel]);

  const drawCanvas = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Fit the image to the viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / img.width, vh / img.height, 1);
    scaleRef.current = scale;

    canvas.width = vw;
    canvas.height = vh;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Center the image
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const offsetX = (vw - drawW) / 2;
    const offsetY = (vh - drawH) / 2;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  }, []);

  const redraw = useCallback((sx: number, sy: number, ex: number, ey: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = canvas.width;
    const vh = canvas.height;
    const scale = scaleRef.current;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const offsetX = (vw - drawW) / 2;
    const offsetY = (vh - drawH) / 2;

    // Redraw image
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

    // Dim everything outside the selection
    const rx = Math.min(sx, ex);
    const ry = Math.min(sy, ey);
    const rw = Math.abs(ex - sx);
    const rh = Math.abs(ey - sy);

    if (rw > 2 && rh > 2) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      // Top
      ctx.fillRect(0, 0, vw, ry);
      // Bottom
      ctx.fillRect(0, ry + rh, vw, vh - ry - rh);
      // Left
      ctx.fillRect(0, ry, rx, rh);
      // Right
      ctx.fillRect(rx + rw, ry, vw - rx - rw, rh);

      // Selection border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);

      // Dimensions label
      const cropScale = scaleRef.current;
      const realW = Math.round(rw / cropScale);
      const realH = Math.round(rh / cropScale);
      const label = `${realW} × ${realH}`;
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const textW = ctx.measureText(label).width + 12;
      const labelX = rx + rw / 2 - textW / 2;
      const labelY = ry > 28 ? ry - 8 : ry + rh + 4;
      ctx.fillRect(labelX, labelY - 14, textW, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, labelX + 6, labelY);
    }
  }, []);

  const getPos = (e: React.MouseEvent) => ({
    x: e.clientX,
    y: e.clientY,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getPos(e);
    setStart(pos);
    setEnd(pos);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    setEnd(pos);
    redraw(start.x, start.y, pos.x, pos.y);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const pos = getPos(e);
    const img = imgRef.current;
    if (!img) return;

    const scale = scaleRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const offsetX = (vw - drawW) / 2;
    const offsetY = (vh - drawH) / 2;

    // Convert screen coords to image coords
    const rx = Math.min(start.x, pos.x);
    const ry = Math.min(start.y, pos.y);
    const rw = Math.abs(pos.x - start.x);
    const rh = Math.abs(pos.y - start.y);

    // Too small = treat as full screenshot
    if (rw < 10 || rh < 10) {
      onCrop(imageDataURL);
      return;
    }

    const imgX = Math.max(0, (rx - offsetX) / scale);
    const imgY = Math.max(0, (ry - offsetY) / scale);
    const imgW = Math.min(img.width - imgX, rw / scale);
    const imgH = Math.min(img.height - imgY, rh / scale);

    // Crop from the original image
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.round(imgW);
    cropCanvas.height = Math.round(imgH);
    const ctx = cropCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, imgX, imgY, imgW, imgH, 0, 0, cropCanvas.width, cropCanvas.height);
      onCrop(cropCanvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] cursor-crosshair">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full pointer-events-none select-none">
        Drag to select the area to screenshot — Esc to cancel
      </div>
    </div>
  );
}
