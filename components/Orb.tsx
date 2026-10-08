'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateScatter, calculateManualScatter } from '@/lib/scatter';
import { useCalendar } from '@/lib/useCalendar';
import { useManualFocus } from '@/lib/useManualFocus';
import { useTabTitle } from '@/lib/useTabTitle';
import { Settings } from './Settings';
import { Overlay } from './Overlay';

const PARTICLE_COUNT = 135000; // Total random points in disk (increased for finer dots)

interface OrbPoint {
  x: number; // position relative to center
  y: number;
  shade: number; // Lambert shade value
  threshold: number; // random threshold for shimmer
  isInside: boolean; // inside orb or stray
  lowerRightBias: number; // for stray dots and scatter drift
  scatterSpeed: number; // random radial speed for scatter (0.4-1.2)
  scatterAngleJitter: number; // random angular jitter for scatter (-0.3 to 0.3 radians)
}

interface FreeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
}

export function Orb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<OrbPoint[]>([]);
  const animationRef = useRef<number | undefined>(undefined);
  const searchParams = useSearchParams();
  const isDemoMode = searchParams.get('demo') === '1';
  const debugScatter = searchParams.get('scatter');
  
  const [scatter, setScatter] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const { nextEvent, refreshCalendar } = useCalendar();
  const { 
    isActive: isManualFocus, 
    timeRemaining: manualTimeRemaining,
    totalDuration: manualTotalDuration,
    startFocus,
    stopFocus 
  } = useManualFocus();

  // Update tab title based on time remaining
  const minutesForTab = isManualFocus && manualTimeRemaining !== null
    ? manualTimeRemaining
    : nextEvent?.minutesToStart ?? null;
  useTabTitle(minutesForTab, isManualFocus);

  // Generate points once (will be regenerated on resize)
  const generatePoints = useCallback((radius: number) => {
    const points: OrbPoint[] = [];
    const N = PARTICLE_COUNT;
    
    // Light direction (normalized): upper-left-front
    const lightX = -0.55;
    const lightY = -0.55;
    const lightZ = 0.63;
    const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
    const Lx = lightX / lightLen;
    const Ly = lightY / lightLen;
    const Lz = lightZ / lightLen;
    
    for (let i = 0; i < N; i++) {
      // True 2D random points in disk slightly larger than orb (1.35×)
      const r = radius * 1.35 * Math.sqrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      
      // Distance from center (normalized)
      const d = Math.sqrt(x * x + y * y) / radius;
      const isInside = d < 1;
      
      // Compute z-coordinate on front hemisphere
      const z = Math.sqrt(Math.max(0, 1 - d * d));
      
      // Surface normal (normalized)
      const nx = x / radius;
      const ny = y / radius;
      
      // Lambert shading
      const lam = Math.max(0, Math.min(1, nx * Lx + ny * Ly + z * Lz));
      
      // Compute shade for this point
      let shade: number;
      if (isInside) {
        // Inside orb: 0.06 + 0.84 * lam^1.2 (capped below 1 to keep dots individual)
        shade = 0.06 + 0.84 * Math.pow(lam, 1.2);
      } else {
        // Stray dots past rim with exponential falloff and lower-right bias
        const distPastRim = d - 1;
        const biasComponent = Math.max(0, Math.min(1, 0.5 + 0.5 * (nx + ny) / Math.max(d, 1e-6) / 1.414));
        shade = 0.25 * Math.exp(-distPastRim * 9) * (0.3 + biasComponent);
      }
      
      points.push({
        x,
        y,
        shade,
        threshold: Math.random(),
        isInside,
        lowerRightBias: Math.max(0, Math.min(1, 0.5 + 0.5 * (nx + ny) / Math.max(d, 1e-6) / 1.414)),
        scatterSpeed: 0.4 + Math.random() * 0.8, // Random speed 0.4-1.2
        scatterAngleJitter: (Math.random() - 0.5) * 0.6, // Random jitter -0.3 to +0.3 radians
      });
    }
    
    return points;
  }, []);

  // Demo mode: cycle scatter 0 -> 1 over 60s, or use debug scatter param
  useEffect(() => {
    // Debug scatter parameter overrides everything
    if (debugScatter !== null) {
      const value = parseFloat(debugScatter);
      if (!isNaN(value)) {
        setScatter(Math.max(0, Math.min(1, value)));
      }
      return;
    }
    
    if (!isDemoMode) return;
    
    const startTime = Date.now();
    const duration = 60000; // 60s
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration;
      setScatter(progress);
    }, 16); // ~60fps
    
    return () => clearInterval(interval);
  }, [isDemoMode, debugScatter]);

  // Calculate scatter from calendar or manual focus
  useEffect(() => {
    if (isDemoMode || debugScatter !== null) return;
    
    const updateScatter = () => {
      if (isManualFocus && manualTimeRemaining !== null && manualTotalDuration !== null) {
        // Manual focus: use calculateManualScatter with total duration
        const manualScatter = calculateManualScatter(manualTimeRemaining, manualTotalDuration);
        setScatter(manualScatter);
      } else if (nextEvent) {
        // Calendar event
        const scatter = calculateScatter(nextEvent.minutesToStart, nextEvent.scatterWindow);
        setScatter(scatter);
      } else {
        // No meetings left today
        setScatter(0);
      }
    };
    
    updateScatter();
    const interval = setInterval(updateScatter, 1000);
    return () => clearInterval(interval);
  }, [isDemoMode, debugScatter, nextEvent, isManualFocus, manualTimeRemaining, manualTotalDuration]);

  // Canvas rendering with true 2D random point sampling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    let dpr = 1;
    
    const resize = () => {
      // Fix aspect ratio with devicePixelRatio for perfect circle
      dpr = window.devicePixelRatio || 1;
      
      // Use physical pixels for canvas backing store
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      
      // CSS size is logical pixels
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      
      // Regenerate points when canvas resizes  
      // Use physical pixels for radius
      // radius 0.20 × 1.35 stray extension × 2 = 54% visual diameter
      const physicalRadius = Math.min(canvas.width, canvas.height) * 0.20;
      pointsRef.current = generatePoints(physicalRadius);
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    let time = 0;
    
    const render = () => {
      time += 0.008;
      
      // Work in physical pixels (canvas backing store coordinates)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.20;
      
      // Clear with dark background
      ctx.fillStyle = '#161616';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Breathing: subtle scale pulse (3%) and threshold shimmer
      const breatheScale = 1 + Math.sin(time * 0.5) * 0.03;
      
      // Re-randomize a small fraction of thresholds for shimmer effect
      if (Math.random() < 0.01) {
        const idx = Math.floor(Math.random() * pointsRef.current.length);
        pointsRef.current[idx].threshold = Math.random();
      }
      
      // Draw all points
      ctx.fillStyle = '#ffffff';
      
      for (const point of pointsRef.current) {
        // Compute keep probability based on scatter
        // At scatter=0: use point.shade directly
        // At scatter=1: dissolving effect with faint core + diffuse spray
        const scatterThresholdRaise = scatter * 0.25; // Very gentle threshold raise
        const scatterDim = 1 - scatter * 0.35; // Gentle dimming so scatter=1 stays visible
        const keepProb = point.shade * scatterDim;
        
        // Skip if below threshold
        if (point.threshold + scatterThresholdRaise >= keepProb) continue;
        
        // Compute position with breathing and scatter offset
        let x = point.x * breatheScale;
        let y = point.y * breatheScale;
        
        // Scatter: offset points outward with randomized radial distance and angular jitter
        if (scatter > 0) {
          const angle = Math.atan2(point.y, point.x);
          
          // Bias toward lower-right with jitter
          const biasedAngle = angle + (Math.PI * 0.2) * point.lowerRightBias * scatter + point.scatterAngleJitter * scatter;
          
          // Random radial distance per point (prevents ring artifact)
          // At scatter=1, points spread 1.5× radius with random variance
          const baseScatterDist = scatter * radius * 1.5;
          const randomRadialDist = baseScatterDist * point.scatterSpeed;
          
          x += Math.cos(biasedAngle) * randomRadialDist;
          y += Math.sin(biasedAngle) * randomRadialDist;
        }
        
        const screenX = centerX + x;
        const screenY = centerY + y;
        
        // Draw 2x2 CSS pixel dots (scaled by DPR for consistent visual size)
        const dotSize = 2 * dpr;
        ctx.fillRect(Math.floor(screenX), Math.floor(screenY), dotSize, dotSize);
      }
      
      // Dim during meeting
      if (nextEvent && nextEvent.minutesToStart <= 0) {
        ctx.fillStyle = 'rgba(22, 22, 22, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      animationRef.current = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [scatter, nextEvent, generatePoints]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'f') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        } else {
          document.exitFullscreen();
          setIsFullscreen(false);
        }
      } else if (e.key === 's') {
        setShowSettings(prev => !prev);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (isManualFocus) {
          stopFocus();
        } else {
          startFocus(25); // Default 25 min
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isManualFocus, startFocus, stopFocus]);

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden"
      onMouseMove={() => setShowOverlay(true)}
      onMouseLeave={() => setShowOverlay(false)}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      
      <Overlay 
        show={showOverlay}
        nextEvent={nextEvent}
        isManualFocus={isManualFocus}
        manualTimeRemaining={manualTimeRemaining}
      />
      
      {showSettings && (
        <Settings 
          onClose={() => setShowSettings(false)}
          onStartFocus={startFocus}
        />
      )}
    </div>
  );
}
