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
      // Animation duration is 3 seconds
      const timer = setTimeout(() => {
        setShowAnimation(false);
        onComplete?.();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!showAnimation) return null;

  return (
    <div className="mist-animation mist-container">
      <div className="mist-particle"></div>
      <div className="mist-particle"></div>
      <div className="mist-particle"></div>
      <div className="mist-particle"></div>
      <div className="mist-particle"></div>
      <div className="mist-particle"></div>
    </div>
  );
}