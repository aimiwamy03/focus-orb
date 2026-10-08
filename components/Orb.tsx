'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateScatter } from '@/lib/scatter';
import { useCalendar } from '@/lib/useCalendar';
import { useManualFocus } from '@/lib/useManualFocus';
import { useTabTitle } from '@/lib/useTabTitle';
import { Settings } from './Settings';
import { Overlay } from './Overlay';

const PARTICLE_COUNT = 8000;
const BASE_RADIUS = 200;

interface Particle {
  theta: number;
  phi: number;
  baseRadius: number;
  offset: number;
  opacity: number;
}

export function Orb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | undefined>(undefined);
  const searchParams = useSearchParams();
  const isDemoMode = searchParams.get('demo') === '1';
  
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

  // Initialize particles
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spherical coordinates with slight randomization
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      const baseRadius = BASE_RADIUS * (0.8 + Math.random() * 0.4);
      
      particles.push({
        theta,
        phi,
        baseRadius,
        offset: Math.random() * Math.PI * 2,
        opacity: 0.6 + Math.random() * 0.4,
      });
    }
    particlesRef.current = particles;
  }, []);

  // Demo mode: cycle scatter 0 -> 1 over 60s
  useEffect(() => {
    if (!isDemoMode) return;
    
    const startTime = Date.now();
    const duration = 60000; // 60s
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration;
      setScatter(progress);
    }, 16); // ~60fps
    
    return () => clearInterval(interval);
  }, [isDemoMode]);

  // Calculate scatter from calendar or manual focus
  useEffect(() => {
    if (isDemoMode) return;
    
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
  }, [isDemoMode, nextEvent, isManualFocus, manualTimeRemaining]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    let time = 0;
    
    const render = () => {
      time += 0.01;
      
      // Clear with dark background
      ctx.fillStyle = '#161616';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Breathing effect
      const breathe = Math.sin(time * 0.5) * 0.05;
      
      particlesRef.current.forEach((particle) => {
        // Convert spherical to cartesian
        const r = particle.baseRadius * (1 + breathe);
        
        // Scatter effect: particles drift outward and fade
        const scatterAmount = scatter * (1 + Math.sin(particle.offset + time) * 0.3);
        const finalRadius = r * (1 + scatterAmount * 3);
        
        const x = finalRadius * Math.sin(particle.theta) * Math.cos(particle.phi);
        const y = finalRadius * Math.sin(particle.theta) * Math.sin(particle.phi);
        const z = finalRadius * Math.cos(particle.theta);
        
        // Simple perspective
        const scale = 1 / (1 + z / 500);
        const screenX = centerX + x * scale;
        const screenY = centerY + y * scale;
        
        // Light direction: upper-left is brighter
        const lightDir = { x: -1, y: -1, z: 1 };
        const nx = Math.sin(particle.theta) * Math.cos(particle.phi);
        const ny = Math.sin(particle.theta) * Math.sin(particle.phi);
        const nz = Math.cos(particle.theta);
        const lighting = Math.max(0, nx * lightDir.x + ny * lightDir.y + nz * lightDir.z);
        
        // Opacity based on scatter and lighting
        let opacity = particle.opacity * (1 - scatter * 0.8) * (0.3 + lighting * 0.7);
        
        // Dim during meeting
        if (nextEvent && nextEvent.minutesToStart <= 0) {
          opacity *= 0.3;
        }
        
        // Particle size based on scatter (stippling effect)
        const size = (1 + scatter * 2) * scale;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add slight glow for brighter particles
        if (lighting > 0.7 && scatter < 0.5) {
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.2})`;
          ctx.beginPath();
          ctx.arc(screenX, screenY, size * 2, 0, Math.PI * 2);
          ctx.fill();
        }
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
