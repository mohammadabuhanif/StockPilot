import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function HeartZap({ className = "w-4 h-4" }: { className?: string }) {
  const containerRef = useRef<SVGSVGElement>(null);
  const zapRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (containerRef.current && zapRef.current) {
      // Heart beat animation
      gsap.to(containerRef.current, {
        scale: 1.2,
        duration: 0.6,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut"
      });

      // Zap flicker animation
      const flicker = () => {
        gsap.to(zapRef.current, {
          opacity: 0.3,
          duration: 0.05,
          repeat: 3,
          yoyo: true,
          onComplete: () => {
            gsap.delayedCall(Math.random() * 3 + 1, flicker);
          }
        });
      };
      flicker();
    }
  }, []);

  return (
    <svg 
      ref={containerRef}
      viewBox="0 0 24 24" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path 
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
        fill="#ef4444"
      />
      <path 
        ref={zapRef}
        d="M13 7l-5 6h4l-1 5 5-6h-4l1-5z" 
        fill="#fbbf24"
        stroke="#ffffff"
        strokeWidth="0.5"
      />
    </svg>
  );
}
