import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface FloatingPath {
  id: number;
  d: string;
  opacity: number;
  duration: number;
}

function generatePaths(count: number): FloatingPath[] {
  const paths: FloatingPath[] = [];
  for (let i = 0; i < count; i++) {
    const startX = Math.random() * 100;
    const startY = Math.random() * 100;
    const cp1x = Math.random() * 100;
    const cp1y = Math.random() * 100;
    const cp2x = Math.random() * 100;
    const cp2y = Math.random() * 100;
    const endX = Math.random() * 100;
    const endY = Math.random() * 100;
    paths.push({
      id: i,
      d: `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
      opacity: 0.03 + Math.random() * 0.06,
      duration: 15 + Math.random() * 20,
    });
  }
  return paths;
}

export function BackgroundPaths({ className = '' }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathsData = useRef(generatePaths(24));

  useEffect(() => {
    if (!svgRef.current) return;

    const paths = svgRef.current.querySelectorAll<SVGPathElement>('.bg-path');
    const ctx = gsap.context(() => {
      paths.forEach((path, i) => {
        const data = pathsData.current[i];
        gsap.fromTo(
          path,
          { strokeDashoffset: path.getTotalLength() },
          {
            strokeDashoffset: 0,
            duration: data.duration,
            ease: 'none',
            repeat: -1,
            delay: i * 0.3,
          }
        );
        gsap.to(path, {
          attr: { opacity: data.opacity * 1.5 },
          duration: data.duration / 3,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      });
    }, svgRef);

    return () => ctx.revert();
  }, []);

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
    >
      {pathsData.current.map((p) => {
        const length = 300;
        return (
          <path
            key={p.id}
            className="bg-path"
            d={p.d}
            stroke="hsl(var(--primary))"
            strokeWidth="0.15"
            opacity={p.opacity}
            strokeDasharray={length}
            strokeDashoffset={length}
            fill="none"
          />
        );
      })}
      {/* Radial gradient overlay for depth */}
      <defs>
        <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.04" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill="url(#bg-glow)" />
    </svg>
  );
}
