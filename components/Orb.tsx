'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateScatter, calculateManualScatter } from '@/lib/scatter';
import { useCalendar } from '@/lib/useCalendar';
import { useManualFocus } from '@/lib/useManualFocus';
import { useTabTitle } from '@/lib/useTabTitle';
import { Settings } from './Settings';
import { Overlay } from './Overlay';

const PARTICLE_COUNT = 3000; // Free particles for scatter effect

interface FreeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
}

export function Orb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const freeParticlesRef = useRef<FreeParticle[]>([]);
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

  // Initialize free particles for scatter effect
  useEffect(() => {
    freeParticlesRef.current = [];
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

  // Canvas rendering with image-space approach
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    let time = 0;
    
    const render = () => {
      time += 0.008;
      
      // Clear with dark background
      ctx.fillStyle = '#161616';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Orb radius: ~50% of viewport height diameter, slightly shrinks with scatter
      const baseRadius = canvas.height * 0.25;
      const breathe = Math.sin(time * 0.5) * 0.03;
      const scatterShrink = 1 - scatter * 0.15; // Slight shrink at high scatter
      const radius = baseRadius * (1 + breathe) * scatterShrink;
      
      // Light direction (normalized): upper-left-front
      const lightX = -0.5;
      const lightY = -0.5;
      const lightZ = 0.707;
      
      // Render orb surface with stochastic (random) dithering
      // Sample every pixel for dense areas, skip some for sparse areas
      const step = 1;
      
      for (let sy = -radius - 20; sy < radius + 20; sy += step) {
        for (let sx = -radius - 20; sx < radius + 20; sx += step) {
          const dx = sx;
          const dy = sy;
          const distSq = dx * dx + dy * dy;
          
          // Skip if outside sphere
          if (distSq > radius * radius) continue;
          
          // Compute z-coordinate on sphere surface (front hemisphere)
          const z = Math.sqrt(radius * radius - distSq);
          
          // Surface normal (normalized)
          const nx = dx / radius;
          const ny = dy / radius;
          const nz = z / radius;
          
          // Lambert shading: dot product with light direction
          let lighting = nx * lightX + ny * lightY + nz * lightZ;
          
          // Map lighting to density with very high values for bright highlight
          if (lighting > 0) {
            // Bright side: very high density for near-solid white
            // Use power curve to boost highlights even more
            lighting = Math.pow((lighting + 0.707) / 1.414, 0.4);
          } else {
            // Dark side: soft falloff
            lighting = Math.max(0, (lighting + 0.707) / 1.414) * 0.3;
          }
          
          // Very high base density (>1.0) in bright areas for near-solid white
          const baseDensity = 1.2;
          
          // Apply scatter: reduce density overall
          const densityFactor = 1 - scatter * 0.8;
          let finalDensity = baseDensity * lighting * densityFactor;
          
          // Clamp to [0, 1]
          finalDensity = Math.max(0, Math.min(1, finalDensity));
          
          // Dim during meeting
          let renderDensity = finalDensity;
          if (nextEvent && nextEvent.minutesToStart <= 0) {
            renderDensity *= 0.25;
          }
          
          const screenX = Math.floor(centerX + sx);
          const screenY = Math.floor(centerY + sy);
          
          // Stochastic dithering: random chance based on density
          // Use deterministic random based on position for stability
          // Add time-based seed component for subtle variation
          const seed = (screenX * 12.9898 + screenY * 78.233 + time * 0.001) * 43758.5453;
          const pseudoRandom = (seed - Math.floor(seed));
          
          // Add slight random adjustment to density to break up any scan-line artifacts
          const jitter = (pseudoRandom * 2 - 1) * 0.05; // ±5% jitter
          const jitteredDensity = Math.max(0, Math.min(1, renderDensity + jitter));
          
          // Scatter effect: some dots become free particles
          if (scatter > 0 && Math.random() < scatter * 0.001) {
            if (freeParticlesRef.current.length < PARTICLE_COUNT) {
              // Bias toward lower-right
              const angle = Math.atan2(dy, dx);
              const biasAngle = angle + (Math.PI * 0.25) * scatter;
              const speed = (0.5 + Math.random() * 0.5) * scatter;
              
              freeParticlesRef.current.push({
                x: screenX,
                y: screenY,
                vx: Math.cos(biasAngle) * speed,
                vy: Math.sin(biasAngle) * speed,
                opacity: renderDensity,
              });
            }
          }
          
          // Draw dot if random value is below density (stochastic dithering)
          // Use second independent random for draw decision
          const seed2 = (screenY * 78.233 + screenX * 12.9898) * 43758.5453;
          const drawRandom = (seed2 - Math.floor(seed2));
          
          if (drawRandom < jitteredDensity) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(screenX, screenY, 1, 1);
          }
        }
      }
      
      // Update and render free particles
      ctx.fillStyle = '#ffffff';
      for (let i = freeParticlesRef.current.length - 1; i >= 0; i--) {
        const p = freeParticlesRef.current[i];
        
        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.opacity *= 0.99; // Fade out
        
        // Remove if faded or off-screen
        if (p.opacity < 0.1 || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          freeParticlesRef.current.splice(i, 1);
          continue;
        }
        
        // Draw particle with opacity
        if (Math.random() < p.opacity) {
          ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
        }
      }
      
      // Clear excess free particles when scatter reduces
      if (freeParticlesRef.current.length > PARTICLE_COUNT * scatter) {
        freeParticlesRef.current.length = Math.floor(PARTICLE_COUNT * scatter);
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
  }, [scatter, nextEvent]);

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
