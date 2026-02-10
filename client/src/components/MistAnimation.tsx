import { useEffect, useState } from 'react';

interface MistAnimationProps {
  isVisible: boolean;
  onComplete?: () => void;
}

export function MistAnimation({ isVisible, onComplete }: MistAnimationProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowAnimation(true);
      // Animation duration is 2 seconds
      const timer = setTimeout(() => {
        setShowAnimation(false);
        onComplete?.();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!showAnimation) return null;

  return (
    <div className="whirlpool-animation">
      {/* Central vortex spiral */}
      <div className="whirlpool-vortex" />

      {/* Liquid droplets spiraling inward */}
      <div className="whirlpool-droplet whirlpool-droplet-1" />
      <div className="whirlpool-droplet whirlpool-droplet-2" />
      <div className="whirlpool-droplet whirlpool-droplet-3" />
      <div className="whirlpool-droplet whirlpool-droplet-4" />
      <div className="whirlpool-droplet whirlpool-droplet-5" />
      <div className="whirlpool-droplet whirlpool-droplet-6" />

      {/* Concentric ripple rings */}
      <div className="whirlpool-ring whirlpool-ring-1" />
      <div className="whirlpool-ring whirlpool-ring-2" />
      <div className="whirlpool-ring whirlpool-ring-3" />
    </div>
  );
}
