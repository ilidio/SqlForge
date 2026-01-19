import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'full' | 'icon';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 48, variant = 'full' }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm"
      >
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        
        {/* The "Forge" Base - Stylized Anvil */}
        <path
          d="M4 18C4 18 4 15 6 14C8 13 16 13 18 14C20 15 20 18 20 18H4Z"
          fill="currentColor"
          className="text-primary/20"
        />
        
        {/* The Database Cylinder being "Forged" */}
        <path
          d="M12 4C8.686 4 6 5.119 6 6.5C6 7.881 8.686 9 12 9C15.314 9 18 7.881 18 6.5C18 5.119 15.314 4 12 4Z"
          fill="url(#logo-gradient)"
        />
        <path
          d="M6 6.5V13.5C6 14.881 8.686 16 12 16C15.314 16 18 14.881 18 13.5V6.5C18 7.881 15.314 9 12 9C8.686 9 6 7.881 6 6.5Z"
          fill="url(#logo-gradient)"
        />
        
        {/* The Spark / AI Pulse */}
        <circle cx="12" cy="6.5" r="1.5" fill="white" fillOpacity="0.5" />
        <path
          d="M12 2V4M12 9V11M19 6.5H21M3 6.5H5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-primary animate-pulse"
        />
      </svg>
      
      {variant === 'full' && (
        <div className="mt-2 flex flex-col items-center">
          <span className="text-2xl font-black tracking-tighter text-foreground uppercase leading-none">
            Sql<span className="text-primary">Forge</span>
          </span>
          <span className="text-[8px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-70">
            AI-Powered Workbench
          </span>
        </div>
      )}
    </div>
  );
};
