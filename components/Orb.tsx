'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateScatter, calculateManualScatter } from '@/lib/scatter';
import { useCalendar } from '@/lib/useCalendar';
import { useManualFocus } from '@/lib/useManualFocus';
import { useTabTitle } from '@/lib/useTabTitle';
import { densityForModel, extractJoinUrl, hoverDetailText, isHeadsUp, minutesBetween, smartFocusOption, statusLineText } from '@/lib/day';
import { Settings } from './Settings';
import { Handbook } from './Handbook';
import { FocusControl } from './FocusControl';
import { StatusLine } from './StatusLine';
import { Timeline } from './Timeline';
import { Satellites } from './Satellites';

const PARTICLE_COUNT = 135000; // Total random points in disk (increased for finer dots)

interface OrbPoint {
  x: number; // position relative to center
  y: number;
  shade: number; // Lambert shade value
  threshold: number; // random threshold for shimmer
  isInside: boolean; // inside orb or stray
  lowerRightBias: number; // for stray dots and scatter drift
  scatterSpeed: number; // random radial speed for scatter (0-1 normalized)
  scatterAngleJitter: number; // random angular jitter for scatter (-0.3 to 0.3 radians)
  escapeAt: number; // scatter level at which this point starts escaping (0-1)
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
  const overlayTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const { nextEvent, day, now, scatterWindow } = useCalendar();
  const density = densityForModel(day);
  const densityRef = useRef(density);
  const inBusyRef = useRef(day.state === 'in-meeting' || day.state === 'in-run');
  densityRef.current = density;
  inBusyRef.current = day.state === 'in-meeting' || day.state === 'in-run';
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
        // Stray dots past rim: continuous with limb shading
        // Evaluate limb shade at d=1 for this angle
        const limbLam = Math.max(0, Math.min(1, nx * Lx + ny * Ly + 0)); // z=0 at limb
        const limbShade = Math.max(0.06 + 0.84 * Math.pow(limbLam, 1.2), 0.05);
        
        // Exponential falloff with lower-right bias
        const distPastRim = d - 1;
        const k = 10 - 6 * Math.max(0, Math.min(1, 0.5 + 0.5 * (nx + ny) / Math.max(d, 1e-6) / 1.414));
        shade = limbShade * Math.exp(-distPastRim * k);
      }
      
      // Compute escapeAt: rim and lower-right points leave first
      // Points with escapeAt >= 1 never escape (~1/3 of core stays put)
      const escapeAt = Math.max(0, Math.min(1.5, 
        Math.random() * 1.5 - 0.5 * Math.max(0, Math.min(1, 0.5 + 0.5 * (nx + ny) / Math.max(d, 1e-6) / 1.414)) * Math.min(d, 1.35) / 1.35
      ));
      
      points.push({
        x,
        y,
        shade,
        threshold: Math.random(),
        isInside,
        lowerRightBias: Math.max(0, Math.min(1, 0.5 + 0.5 * (nx + ny) / Math.max(d, 1e-6) / 1.414)),
        scatterSpeed: Math.random(), // Normalized 0-1
        scatterAngleJitter: (Math.random() - 0.5) * 0.9, // Random jitter -0.45 to +0.45 radians
        escapeAt,
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
      } else if (day.state === 'in-meeting' || day.state === 'in-run') {
        setScatter(1);
      } else if (day.nextEvent) {
        const minutesToStart = minutesBetween(now, day.nextEvent.start);
        setScatter(calculateScatter(minutesToStart, scatterWindow));
      } else {
        // No meetings left today
        setScatter(0);
      }
    };
    
    updateScatter();
    const interval = setInterval(updateScatter, 1000);
    return () => clearInterval(interval);
  }, [isDemoMode, debugScatter, day, now, scatterWindow, isManualFocus, manualTimeRemaining, manualTotalDuration]);

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
        // Per-point escape model
        const progress = scatter <= point.escapeAt 
          ? 0 
          : Math.min(1, (scatter - point.escapeAt) / (1 - point.escapeAt + 1e-6));
        
        // Keep probability based on escape state.
        // Gap-aware brightness scales only the starting keep probability.
        const startingKeep = point.shade * densityRef.current;
        let keepProb: number;
        if (progress === 0) {
          // Non-escaped: shade with gentle dimming
          keepProb = startingKeep * (1 - 0.4 * scatter);
        } else {
          // Escaped: fade as it travels
          keepProb = startingKeep * (1 - 0.75 * progress);
        }
        
        // Skip if below threshold
        if (point.threshold >= keepProb) continue;
        
        // Compute position with breathing
        let x = point.x * breatheScale;
        let y = point.y * breatheScale;
        
        // Scatter displacement for escaped points only
        if (progress > 0) {
          // Radial unit vector
          const radialDist = Math.sqrt(point.x * point.x + point.y * point.y);
          const radialUnitX = radialDist > 1e-6 ? point.x / radialDist : 1;
          const radialUnitY = radialDist > 1e-6 ? point.y / radialDist : 0;
          
          // Mix 15% radial + 85% toward lower-right (0.7071, 0.7071)
          const mixedDirX = 0.15 * radialUnitX + 0.85 * 0.7071;
          const mixedDirY = 0.15 * radialUnitY + 0.85 * 0.7071;
          
          // Normalize
          const mixedDirLen = Math.sqrt(mixedDirX * mixedDirX + mixedDirY * mixedDirY);
          const dirX = mixedDirX / mixedDirLen;
          const dirY = mixedDirY / mixedDirLen;
          
          // Apply angle jitter by rotating direction
          const cosJitter = Math.cos(point.scatterAngleJitter);
          const sinJitter = Math.sin(point.scatterAngleJitter);
          const rotatedDirX = dirX * cosJitter - dirY * sinJitter;
          const rotatedDirY = dirX * sinJitter + dirY * cosJitter;
          
          // Escape distance
          const escapeDist = progress * radius * (0.3 + 1.1 * point.scatterSpeed);
          
          x += rotatedDirX * escapeDist;
          y += rotatedDirY * escapeDist;
        }
        
        const screenX = centerX + x;
        const screenY = centerY + y;
        
        // Draw 2x2 CSS pixel dots (scaled by DPR for consistent visual size)
        const dotSize = 2 * dpr;
        ctx.fillRect(Math.floor(screenX), Math.floor(screenY), dotSize, dotSize);
      }
      
      // Dim during a meeting or back-to-back run
      if (inBusyRef.current) {
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

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden"
      data-satellites={day.remainingInRun.length}
      onMouseMove={() => {
        setShowOverlay(true);
        if (overlayTimeoutRef.current) {
          clearTimeout(overlayTimeoutRef.current);
        }
        overlayTimeoutRef.current = setTimeout(() => {
          setShowOverlay(false);
        }, 3000);
      }}
      onMouseLeave={() => {
        setShowOverlay(false);
        if (overlayTimeoutRef.current) {
          clearTimeout(overlayTimeoutRef.current);
        }
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      <StatusLine
        text={statusLineText(day, now)}
        detail={hoverDetailText(day, now)}
        hovered={showOverlay}
        joinUrl={isHeadsUp(day, now) ? extractJoinUrl(day.nextEvent) : null}
      />

      <Satellites count={day.state === 'in-run' ? day.remainingInRun.length : 0} />

      <Timeline
        events={day.events}
        now={now}
        hidden={isFullscreen && !showOverlay}
      />
      
      <Handbook />
      
      <FocusControl
        isActive={isManualFocus}
        timeRemaining={manualTimeRemaining}
        onStart={startFocus}
        onStop={stopFocus}
        smartFocus={day.state === 'free' ? smartFocusOption(now, day.nextEvent?.start ?? null) : null}
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
