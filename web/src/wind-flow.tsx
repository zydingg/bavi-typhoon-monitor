import { useEffect, useRef } from 'react';

export interface WindCenter {
  x: number;
  y: number;
}

export interface WindParticle {
  x: number;
  y: number;
  alpha: number;
  length?: number;
}

export interface WindFlowLayerProps {
  center: WindCenter | null;
  intensity: number;
  label: string;
}

interface WindBounds {
  width: number;
  height: number;
}

function wrap(value: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return ((value % limit) + limit) % limit;
}

export function advanceParticle(
  particle: WindParticle,
  center: WindCenter,
  intensity: number,
  bounds: WindBounds,
): WindParticle {
  const dx = particle.x - center.x;
  const dy = particle.y - center.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const tangentX = -dy / distance;
  const tangentY = dx / distance;
  const inwardX = -dx / distance;
  const inwardY = -dy / distance;
  const speed = Math.max(intensity / 30, 0.8);
  const inwardStrength = 0.12;

  return {
    ...particle,
    x: wrap(particle.x + (tangentX + inwardX * inwardStrength) * speed, bounds.width),
    y: wrap(particle.y + (tangentY + inwardY * inwardStrength) * speed, bounds.height),
  };
}

function createParticles(count: number, bounds: WindBounds): WindParticle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * bounds.width,
    y: Math.random() * bounds.height,
    alpha: 0.35 + Math.random() * 0.65,
    length: 2 + Math.random() * 4,
  }));
}

export function WindFlowLayer({ center, intensity, label }: WindFlowLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    let bounds: WindBounds = { width: 0, height: 0 };
    let particles: WindParticle[] = [];
    let frame = 0;

    const resize = (width: number, height: number) => {
      bounds = { width: Math.max(0, Math.round(width)), height: Math.max(0, Math.round(height)) };
      canvas.width = bounds.width;
      canvas.height = bounds.height;
      particles = createParticles(window.innerWidth < 700 ? 96 : 220, bounds);
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      resize(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(canvas);
    const initialBounds = canvas.getBoundingClientRect();
    resize(initialBounds.width, initialBounds.height);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion && center && context) {
      const animate = () => {
        context.clearRect(0, 0, bounds.width, bounds.height);
        particles = particles.map((particle) => {
          const nextParticle = advanceParticle(particle, center, intensity, bounds);
          const movementX = nextParticle.x - particle.x;
          const movementY = nextParticle.y - particle.y;
          const movementLength = Math.hypot(movementX, movementY) || 1;
          const segmentLength = particle.length ?? 2;

          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(
            particle.x + (movementX / movementLength) * segmentLength,
            particle.y + (movementY / movementLength) * segmentLength,
          );
          context.strokeStyle = `rgba(163, 240, 255, ${particle.alpha})`;
          context.lineWidth = 1;
          context.stroke();

          return nextParticle;
        });
        frame = window.requestAnimationFrame(animate);
      };

      frame = window.requestAnimationFrame(animate);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [center, intensity]);

  return <canvas className="wind-flow-layer" ref={canvasRef} aria-label={label} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}
