import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface CatAssistantProps {
  isThinking?: boolean;
  isTalking?: boolean;
  className?: string;
}

export default function CatAssistant({ isThinking, isTalking, className }: CatAssistantProps) {
  const catRef = useRef<SVGSVGElement>(null);
  const tailRef = useRef<SVGPathElement>(null);
  const leftPawRef = useRef<SVGGElement>(null);
  const rightPawRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const earsRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!catRef.current) return;

    // Tail animation
    gsap.to(tailRef.current, {
      rotate: 15,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      transformOrigin: "bottom center"
    });

    // Ear twitch
    const twitchEars = () => {
      gsap.to(earsRef.current, {
        scaleY: 0.8,
        duration: 0.1,
        repeat: 1,
        yoyo: true,
        onComplete: () => {
          setTimeout(twitchEars, Math.random() * 3000 + 2000);
        }
      });
    };
    twitchEars();

    return () => {
      gsap.killTweensOf([tailRef.current, earsRef.current]);
    };
  }, []);

  useEffect(() => {
    if (isThinking) {
      gsap.to(leftPawRef.current, {
        y: -10,
        rotate: -10,
        duration: 0.5,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut"
      });
    } else {
      gsap.to(leftPawRef.current, { y: 0, rotate: 0, duration: 0.3 });
    }
  }, [isThinking]);

  useEffect(() => {
    if (isTalking) {
      gsap.to(mouthRef.current, {
        scaleY: 1.5,
        duration: 0.15,
        repeat: -1,
        yoyo: true,
        transformOrigin: "center top"
      });
    } else {
      gsap.to(mouthRef.current, { scaleY: 1, duration: 0.2 });
    }
  }, [isTalking]);

  return (
    <svg
      ref={catRef}
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Tail */}
      <path
        ref={tailRef}
        d="M140,150 Q160,130 150,110"
        stroke="#FFB7C5"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Body */}
      <ellipse cx="100" cy="140" rx="45" ry="35" fill="#FFF0F5" stroke="#FFB7C5" strokeWidth="2" />
      
      {/* Head */}
      <g ref={earsRef}>
        <path d="M70,75 L60,50 L85,65 Z" fill="#FFB7C5" />
        <path d="M130,75 L140,50 L115,65 Z" fill="#FFB7C5" />
      </g>
      <circle cx="100" cy="90" r="35" fill="#FFF0F5" stroke="#FFB7C5" strokeWidth="2" />
      
      {/* Eyes */}
      <circle cx="85" cy="85" r="3" fill="#4A4A4A" />
      <circle cx="115" cy="85" r="3" fill="#4A4A4A" />
      
      {/* Nose */}
      <path d="M97,95 L103,95 L100,98 Z" fill="#FFB7C5" />
      
      {/* Mouth */}
      <path
        ref={mouthRef}
        d="M95,105 Q100,110 105,105"
        stroke="#FFB7C5"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Paws */}
      <g ref={leftPawRef}>
        <circle cx="80" cy="165" r="8" fill="#FFF0F5" stroke="#FFB7C5" strokeWidth="1.5" />
      </g>
      <g ref={rightPawRef}>
        <circle cx="120" cy="165" r="8" fill="#FFF0F5" stroke="#FFB7C5" strokeWidth="1.5" />
      </g>
      
      {/* Whiskers */}
      <line x1="75" y1="95" x2="60" y2="92" stroke="#FFB7C5" strokeWidth="1" />
      <line x1="75" y1="100" x2="60" y2="100" stroke="#FFB7C5" strokeWidth="1" />
      <line x1="125" y1="95" x2="140" y2="92" stroke="#FFB7C5" strokeWidth="1" />
      <line x1="125" y1="100" x2="140" y2="100" stroke="#FFB7C5" strokeWidth="1" />
    </svg>
  );
}
