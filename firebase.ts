import React from 'react';

export function StoreSeal({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={`w-full h-full ${className}`}>
      <defs>
        <path id="textPathBottom" d="M 160,100 A 60,60 0 0,1 40,100" />
      </defs>

      {/* Clean Outer Border */}
      <circle cx="100" cy="100" r="90" fill="none" stroke="#1e3a8a" strokeWidth="4" />
      <circle cx="100" cy="100" r="85" fill="none" stroke="#1e3a8a" strokeWidth="1" />
      <circle cx="100" cy="100" r="60" fill="none" stroke="#1e3a8a" strokeWidth="1.5" />

      {/* Bottom Text */}
      <text fill="#1e3a8a" fontSize="16" fontWeight="bold" letterSpacing="2" fontFamily="sans-serif">
        <textPath href="#textPathBottom" startOffset="50%" textAnchor="middle">
           AUTHORIZED SEAL
        </textPath>
      </text>

      {/* Center Minimal SDC */}
      <g transform="translate(100, 100)">
        <text x="0" y="16" textAnchor="middle" fontSize="56" fontWeight="900" fontFamily="sans-serif" fill="#1e3a8a" letterSpacing="-2">
          SDC
        </text>
      </g>
    </svg>
  );
}

