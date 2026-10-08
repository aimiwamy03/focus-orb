'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateScatter } from '@/lib/scatter';
import { useCalendar } from '@/lib/useCalendar';
import { useManualFocus } from '@/lib/useManualFocus';
import { useTabTitle } from '@/lib/useTabTitle';
import { Settings } from './Settings';
import { Overlay } from './Overlay';

const PARTICLE_COUNT = 24000;

interface Particle {
  x: number;
  y: number;
  z: number;
  offset: number;
}

export function Orb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
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
    startFocus,
    stopFocus 
  } = useManualFocus();

  // Update tab title based on time remaining
  const minutesForTab = isManualFocus && manualTimeRemaining !== null
    ? manualTimeRemaining
    : nextEvent?.minutesToStart ?? null;
  useTabTitle(minutesForTab, isManualFocus);

  // Initialize particles on a sphere
  useEffect(() => {
    const particles: Particle[] = [];
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Evenly distributed points on sphere using Fibonacci sphere algorithm
      const phi = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      
      particles.push({
        x,
        y,
        z,
        offset: Math.random() * Math.PI * 2,
      });
    }
    
    particlesRef.current = particles;
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
      if (isManualFocus && manualTimeRemaining !== null) {
        // Manual focus: use manual time remaining
        const manualScatter = calculateScatter(manualTimeRemaining, 60); // Last 60 min ramp
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
  }, [isDemoMode, debugScatter, nextEvent, isManualFocus, manualTimeRemaining]);

  // Canvas rendering
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
      
      // Sphere radius: 45-55% of viewport height
      const baseRadius = canvas.height * 0.25;
      
      // Subtle breathing effect
      const breathe = Math.sin(time * 0.5) * 0.03;
      const radius = baseRadius * (1 + breathe);
      
      particlesRef.current.forEach((particle) => {
        // Scatter effect: particles drift outward
        const scatterAmount = scatter * (1 + Math.sin(particle.offset + time * 0.5) * 0.2);
        const finalRadius = radius * (1 + scatterAmount * 2.5);
        
        const x = particle.x * finalRadius;
        const y = particle.y * finalRadius;
        const z = particle.z * finalRadius;
        
        const screenX = centerX + x;
        const screenY = centerY + y;
        
        // Lighting calculation: upper-left is brighter
        // Light direction vector (normalized)
        const lightX = -0.5;
        const lightY = -0.5;
        const lightZ = 0.707; // sqrt(0.5)
        
        // Dot product with surface normal (particle position normalized)
        const lighting = Math.max(0, 
          particle.x * lightX + 
          particle.y * lightY + 
          particle.z * lightZ
        );
        
        // Dithered stippling: use lighting to determine draw probability
        // At scatter=0: very dense, nearly solid where lit
        // At scatter=1: sparse, scattered
        const baseDensity = 1 - scatter * 0.85;
        const density = baseDensity * (0.2 + lighting * 0.8);
        
        // Dim during meeting
        let finalDensity = density;
        if (nextEvent && nextEvent.minutesToStart <= 0) {
          finalDensity *= 0.25;
        }
        
        // Stochastic dithering: only draw if random value is below density
        // Use z-depth as deterministic "random" seed for stability
        const seed = (Math.sin(particle.x * 12.9898 + particle.y * 78.233 + z * 45.164) * 43758.5453) % 1;
        if (seed > finalDensity) return;
        
        // Draw uniform small dot (1-2px)
        const dotSize = 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.floor(screenX), Math.floor(screenY), dotSize, dotSize);
      });
      
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
