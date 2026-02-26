interface GrainLogoProps {
  size?: number;
  variant?: 'full' | 'mark' | 'favicon';
  className?: string;
  animated?: boolean;
}

export function GrainLogo({ size = 24, variant = 'full', className = '', animated = false }: GrainLogoProps) {
  const showCorners = variant === 'full';
  const showIris = variant !== 'favicon';
  const showScanLine = variant === 'full';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Corner registration marks — viewfinder frame */}
      {showCorners && (
        <>
          <path d="M2 5V2H5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
          <path d="M19 2H22V5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
          <path d="M22 19V22H19" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
          <path d="M5 22H2V19" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
        </>
      )}

      {/* Outer eye shape — two bezier arcs */}
      <path
        d="M2 12Q7 4 12 4Q17 4 22 12Q17 20 12 20Q7 20 2 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Iris ring */}
      {showIris && (
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      )}

      {/* Scan line — playback head */}
      {showScanLine && (
        <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="0.75" opacity="0.2" />
      )}

      {/* Pupil / grain recording dot */}
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="#06b6d4"
        className={animated ? 'animate-glow-pulse' : undefined}
      />
    </svg>
  );
}
