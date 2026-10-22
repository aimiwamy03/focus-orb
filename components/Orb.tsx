'use client';

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCalendar } from '@/lib/useCalendar';
import { useManualFocus } from '@/lib/useManualFocus';
import { useLiveTab } from '@/lib/useLiveTab';
import {
  agendaClearsOrb,
  buildAgenda,
  loadShowAgenda,
  saveShowAgenda,
  shouldShowAgenda,
  visibleAgendaSections,
} from '@/lib/agenda';
import { densityForModel, extractJoinUrl, hoverDetailText, isHeadsUp, minutesBetween, statusLineText } from '@/lib/day';
import { orbLayout, type OrbLayout } from '@/lib/layout';
import {
  DurationChoice,
  FALLBACK_TASK,
  formatMeetingSoonCopy,
  formatMiniFocusStatus,
  loadLastDuration,
  loadLastTask,
  loadRecentTasks,
  promptSurface,
  rememberTask,
  resolveDuration,
  resolveStartTask,
  saveLastDuration,
  saveLastTask,
  saveRecentTasks,
  untilMeetingDuration,
} from '@/lib/focusPrompt';
import { collectTextClearRects, textClearAlpha } from '@/lib/textClear';
import {
  breathGlow,
  breathPhase,
  breathScale,
  canUseDocumentPip,
  CHROME_HINT,
  FLOATING_RESTORE_LABEL,
  formatMiniStatus,
  LEAVE_TAB_HINT,
  loadPopOutOnLeave,
  MINI_ONLY_LABEL,
  MINI_SIZE,
  POP_OUT_LABEL,
  savePopOutOnLeave,
  scatterFromVisualInput,
} from '@/lib/miniOrb';
import {
  shouldRegeneratePoints,
  stepVisualScatter,
} from '@/lib/orbMotion';
import {
  FULLSCREEN_LABEL,
  isShortcutKey,
  loadShortcutsCardSeen,
  saveShortcutsCardSeen,
  shouldShowShortcutsCard,
} from '@/lib/shortcuts';
import { drawMiniOrbOnCanvas, ensureMiniCanvasSize } from '@/lib/drawMiniOrb';
import { sizeOrbCanvas } from '@/lib/orbCanvas';
import { useMiniWindow } from '@/components/useMiniWindow';
import { StackBoundary } from '@/components/StackBoundary';
import { Settings } from './Settings';
import { Hints, markHintSeen } from './Hints';
import { Agenda } from './Agenda';
import { FocusPrompt } from './FocusPrompt';
import { StatusLine } from './StatusLine';
import { Timeline } from './Timeline';
import { Satellites } from './Satellites';
import { Welcome } from './Welcome';
import { MiniOrbView } from './MiniOrbView';
import { KeyHint } from './KeyHint';
import { ShortcutsCard } from './ShortcutsCard';
import { isFirstOpen, isGoogleConfigured } from '@/lib/onboarding';
import { SAMPLE_DAY_LABEL } from '@/lib/fixtures';
import { signInWithGoogle } from '@/app/actions';

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
  const settingsParam = searchParams.get('settings') === '1';
  const hoverParam = searchParams.get('hover') === '1';
  const miniPreview = searchParams.get('mini') === '1';
  const forceUnsupported = searchParams.get('unsupported') === '1';
  const miniOnlyParam = searchParams.get('minionly') === '1';
  const focusParam = searchParams.get('focus');
  const promptParam = searchParams.get('prompt');
  const taskParam = searchParams.get('task');
  const doneParam = searchParams.get('done');
  const pipSupported = useSyncExternalStore(
    () => () => {},
    () => canUseDocumentPip() && !forceUnsupported,
    () => false
  );
  
  const [scatter, setScatter] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orbHovered, setOrbHovered] = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [skipHeadsUp, setSkipHeadsUp] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [recentTasks, setRecentTasks] = useState<string[]>([]);
  const [durationChoice, setDurationChoice] = useState<DurationChoice>(50);
  const [hintRev, setHintRev] = useState(0);
  const [miniOnly, setMiniOnly] = useState(miniOnlyParam);
  const [popOutOnLeave, setPopOutOnLeave] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [leaveHint, setLeaveHint] = useState(false);
  const [showShortcutsCard, setShowShortcutsCard] = useState(false);
  const [showAgenda, setShowAgenda] = useState(true);
  const [viewSize, setViewSize] = useState({ w: 1280, h: 800 });
  const overlayTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const handleOrbClickRef = useRef<() => void>(() => {});
  const miniOnlyRef = useRef(false);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef<OrbLayout>({
    radius: 160,
    centerX: 640,
    centerY: 400,
    availableH: 400,
  });
  const askDimRef = useRef(false);
  const miniDrawRef = useRef({
    scatter: 0,
    density: 1,
    dim: false,
    focusing: false,
    reducedMotion: false,
  });
  const hoverBoostRef = useRef(1);
  const scatterRef = useRef(scatter);
  const visualScatterRef = useRef(scatter);
  scatterRef.current = scatter;
  
  const calendar = useCalendar();
  const { nextEvent, day, now, scatterWindow } = calendar;
  const density = densityForModel(day);
  const densityRef = useRef(density);
  const inBusyRef = useRef(day.state === 'in-meeting' || day.state === 'in-run');
  densityRef.current = density;
  inBusyRef.current = day.state === 'in-meeting' || day.state === 'in-run';
  const { 
    isActive: isManualFocus, 
    isBreak,
    task: sessionTask,
    timeRemaining: manualTimeRemaining,
    totalDuration: manualTotalDuration,
    completed,
    startFocus,
    startBreak,
    stopFocus,
    dismissCompleted,
    seedCompleted,
  } = useManualFocus();

  const tabTitle = useLiveTab({
    model: day,
    now,
    scatter,
    isManualFocus,
    focusMinutes: manualTimeRemaining,
  });

  const firstOpen = isFirstOpen({
    mockScenario: calendar.mockScenario,
    isGoogleConnected: calendar.isGoogleConnected,
    calendarUrl: calendar.calendarUrl,
    authMethod: calendar.authMethod,
  });

  const showChrome = !firstOpen && !miniOnly && !showSettings && (showOverlay || hoverParam);

  const surface = promptSurface({
    firstOpen,
    miniOnly,
    isFocusing: isManualFocus,
    isBreak: Boolean(isBreak),
    stopConfirm,
    completed: Boolean(completed),
    headsUp: isHeadsUp(day, now),
    skipHeadsUp,
    dayState: day.state,
  });
  const untilMinutes = untilMeetingDuration(day);
  const activeTask = sessionTask || taskDraft || loadLastTask() || FALLBACK_TASK;

  const miniFocusStatus = formatMiniFocusStatus({
    surface,
    task: activeTask,
    minutes: manualTimeRemaining,
  });
  const miniStatus =
    miniFocusStatus ??
    formatMiniStatus(day, now, {
      isManualFocus,
      focusMinutes: manualTimeRemaining,
    });

  const miniWindow = useMiniWindow({
    supported: pipSupported,
    status: miniStatus,
    onOrbClick: () => handleOrbClickRef.current(),
    onClosed: () => {
      setMiniOnly(false);
    },
  });

  miniOnlyRef.current = miniOnly;
  askDimRef.current =
    surface === 'ask' || surface === 'completed' || surface === 'break';
  miniDrawRef.current = {
    scatter,
    density,
    dim: day.state === 'in-meeting' || day.state === 'in-run',
    focusing: isManualFocus,
    reducedMotion,
  };

  const line =
    surface === 'meeting-soon' && day.nextEvent
      ? formatMeetingSoonCopy(minutesBetween(now, day.nextEvent.start))
      : statusLineText(day, now);

  const agendaSections = visibleAgendaSections(
    buildAgenda(calendar.events, now),
    viewSize.h
  );
  const focusingSurface = surface === 'focusing' || surface === 'stop-confirm';
  const idleAgendaSurface =
    surface === 'ask' ||
    surface === 'break' ||
    surface === 'completed' ||
    surface === 'meeting-soon';
  const mountAgenda =
    showAgenda &&
    !firstOpen &&
    !miniOnly &&
    !showSettings &&
    shouldShowAgenda({
      enabled: true,
      surface: idleAgendaSurface || focusingSurface ? surface : null,
      viewW: viewSize.w,
      viewH: viewSize.h,
      chromeVisible: true,
      clearsOrb: agendaClearsOrb(layoutRef.current),
    });
  const agendaFaded = focusingSurface && !showChrome;

  const updateLayout = useCallback(() => {
    if (typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    const viewW = canvas?.clientWidth || window.innerWidth;
    const viewH = canvas?.clientHeight || window.innerHeight;
    const stackH = stackRef.current?.getBoundingClientRect().height ?? 0;
    layoutRef.current = orbLayout(viewW, viewH, stackH);
    setViewSize((current) =>
      current.w === viewW && current.h === viewH ? current : { w: viewW, h: viewH }
    );
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) sizeOrbCanvas(canvas);
    updateLayout();
    const node = stackRef.current;
    const observer = node ? new ResizeObserver(() => updateLayout()) : null;
    if (node && observer) observer.observe(node);
    window.addEventListener('resize', updateLayout);
    window.visualViewport?.addEventListener('resize', updateLayout);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateLayout);
      window.visualViewport?.removeEventListener('resize', updateLayout);
    };
  }, [updateLayout, surface, miniOnly, firstOpen]);

  useEffect(() => {
    setPopOutOnLeave(loadPopOutOnLeave());
    setRecentTasks(loadRecentTasks());
    const storedDuration = loadLastDuration();
    if (storedDuration != null) setDurationChoice(storedDuration);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const openMiniRef = useRef(miniWindow.open);
  const pipOpenRef = useRef(miniWindow.isOpen);
  openMiniRef.current = miniWindow.open;
  pipOpenRef.current = miniWindow.isOpen;

  useEffect(() => {
    if (!popOutOnLeave || !pipSupported) return;
    const onVisibility = async () => {
      if (document.visibilityState !== 'hidden') return;
      if (pipOpenRef.current) return;
      const ok = await openMiniRef.current();
      if (!ok) setLeaveHint(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [popOutOnLeave, pipSupported]);

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
      const next = scatterFromVisualInput({
        isManualFocus,
        focusMinutes: manualTimeRemaining,
        totalMinutes: manualTotalDuration,
        model: day,
        now,
        scatterWindow,
      });
      setScatter((prev) => (Math.abs(prev - next) < 1e-6 ? prev : next));
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
    let lastBox = { width: 0, height: 0, dpr: 0 };
    let lastPhysicalRadius = 0;
    
    const resize = () => {
      const sized = sizeOrbCanvas(canvas);
      const boxChanged =
        Math.abs(sized.width - lastBox.width) > 0.5 ||
        Math.abs(sized.height - lastBox.height) > 0.5 ||
        sized.dpr !== lastBox.dpr;
      dpr = sized.dpr;
      updateLayout();
      const physicalRadius = layoutRef.current.radius * dpr;
      if (
        pointsRef.current.length > 0 &&
        !boxChanged &&
        !shouldRegeneratePoints(lastPhysicalRadius, physicalRadius)
      ) {
        return;
      }
      lastBox = sized;
      if (
        pointsRef.current.length === 0 ||
        shouldRegeneratePoints(lastPhysicalRadius, physicalRadius)
      ) {
        pointsRef.current = generatePoints(physicalRadius);
        lastPhysicalRadius = physicalRadius;
      }
    };
    
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    
    let time = 0;
    let lastTs = 0;

    const paintMini = (visualScatter: number) => {
      const frame = miniDrawRef.current;
      const phase = frame.focusing ? breathPhase(performance.now()) : 0;
      const payload = {
        scatter: visualScatter,
        density: frame.density,
        dim: frame.dim,
        scale: frame.focusing ? breathScale(phase, frame.reducedMotion) : 1,
        glow: breathGlow(phase, frame.focusing),
      };
      for (const target of [miniWindow.canvasRef.current, previewCanvasRef.current]) {
        if (!target) continue;
        ensureMiniCanvasSize(target);
        drawMiniOrbOnCanvas(target, payload);
      }
    };
    
    const render = (ts: number) => {
      const dt = lastTs === 0 ? 16 : Math.min(64, ts - lastTs);
      lastTs = ts;
      time += 0.008;

      visualScatterRef.current = stepVisualScatter(
        visualScatterRef.current,
        scatterRef.current,
        dt
      );
      const visualScatter = visualScatterRef.current;
      const debug = window as Window & {
        __orbScatter?: { target: number; visual: number };
      };
      debug.__orbScatter = {
        target: scatterRef.current,
        visual: visualScatter,
      };
      
      const layout = layoutRef.current;
      const physicalRadius = layout.radius * dpr;
      if (shouldRegeneratePoints(lastPhysicalRadius, physicalRadius)) {
        pointsRef.current = generatePoints(physicalRadius);
        lastPhysicalRadius = physicalRadius;
      }
      const centerX = layout.centerX * dpr;
      const centerY = layout.centerY * dpr;
      const radius = physicalRadius;
      const hoverBoost = hoverBoostRef.current;
      const breatheAmp = visualScatter < 0.05 ? 0.05 : 0.03;
      
      // Clear with dark background
      ctx.fillStyle = '#161616';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (miniOnlyRef.current) {
        paintMini(visualScatter);
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      const frame = miniDrawRef.current;
      const focusPhase = frame.focusing ? breathPhase(performance.now()) : 0;
      if (frame.focusing) {
        const glow = breathGlow(focusPhase, true);
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          radius * 0.18,
          centerX,
          centerY,
          radius * (1.15 + 0.35 * glow)
        );
        gradient.addColorStop(0, `rgba(255,255,255,${0.16 * glow})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Breathing: focus uses the 5s inhale/exhale; otherwise a slight idle pulse
      const breatheScale = frame.focusing
        ? breathScale(focusPhase, frame.reducedMotion)
        : 1 + Math.sin(time * 0.45) * breatheAmp;
      
      // Re-randomize a small fraction of thresholds for shimmer effect
      if (Math.random() < 0.01) {
        const idx = Math.floor(Math.random() * pointsRef.current.length);
        pointsRef.current[idx].threshold = Math.random();
      }
      
      // Draw all points, skipping or fading any that sit under text.
      const clearRects = collectTextClearRects();
      ctx.fillStyle = '#ffffff';
      
      for (const point of pointsRef.current) {
        // Per-point escape model
        const progress = visualScatter <= point.escapeAt 
          ? 0 
          : Math.min(1, (visualScatter - point.escapeAt) / (1 - point.escapeAt + 1e-6));
        
        // Keep probability based on escape state.
        // Gap-aware brightness scales only the starting keep probability.
        const startingKeep = point.shade * densityRef.current * hoverBoost;
        let keepProb: number;
        if (progress === 0) {
          // Non-escaped: shade with gentle dimming
          keepProb = startingKeep * (1 - 0.4 * visualScatter);
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
        const clearAlpha = textClearAlpha(screenX / dpr, screenY / dpr, clearRects);
        if (clearAlpha <= 0) continue;
        
        // Draw 2x2 CSS pixel dots (scaled by DPR for consistent visual size)
        const dotSize = 2 * dpr;
        if (clearAlpha < 1) {
          ctx.fillStyle = `rgba(255,255,255,${clearAlpha})`;
          ctx.fillRect(Math.floor(screenX), Math.floor(screenY), dotSize, dotSize);
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillRect(Math.floor(screenX), Math.floor(screenY), dotSize, dotSize);
        }
      }
      
      // Dim during a meeting, or quietly while asking
      if (inBusyRef.current && !miniOnlyRef.current) {
        ctx.fillStyle = 'rgba(22, 22, 22, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (askDimRef.current && !miniOnlyRef.current) {
        ctx.fillStyle = 'rgba(22, 22, 22, 0.42)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      paintMini(visualScatter);
      
      animationRef.current = requestAnimationFrame(render);
    };
    
    animationRef.current = requestAnimationFrame(render);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // Scatter and nextEvent must stay out of these deps. On production main
    // they remounted this effect, restarted a 2s gather, and slammed the
    // dots to fully scattered every calendar poll or scatter tick.
  }, [generatePoints, updateLayout]);

  const dismissShortcutsCard = useCallback(() => {
    saveShortcutsCardSeen();
    setShowShortcutsCard(false);
  }, []);

  useEffect(() => {
    if (
      !shouldShowShortcutsCard({
        firstOpen,
        miniOnly,
        seen: loadShortcutsCardSeen(),
        surface,
      })
    ) {
      setShowShortcutsCard(false);
      return;
    }
    setShowShortcutsCard(true);
  }, [firstOpen, miniOnly, surface]);

  const toggleFullscreen = () => {
    markHintSeen('fullscreen');
    setHintRev((n) => n + 1);
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (isShortcutKey(e.key)) dismissShortcutsCard();

      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 's' || e.key === 'S') {
        setShowSettings(prev => !prev);
      } else if (e.key === ' ') {
        e.preventDefault();
        handleOrbClickRef.current();
      } else if (e.key === 'p' || e.key === 'P') {
        if (!pipSupported) return;
        e.preventDefault();
        if (miniWindow.isOpen) miniWindow.close();
        else void miniWindow.open();
      } else if (e.key === 'Escape' && miniOnlyRef.current) {
        e.preventDefault();
        setMiniOnly(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissShortcutsCard, miniWindow, pipSupported]);

  const bumpHint = (id: 'click' | 'hover' | 'fullscreen') => {
    markHintSeen(id);
    setHintRev((n) => n + 1);
  };

  const isOverOrb = (clientX: number, clientY: number) => {
    const layout = layoutRef.current;
    const dx = clientX - layout.centerX;
    const dy = clientY - layout.centerY;
    return dx * dx + dy * dy <= layout.radius * layout.radius;
  };

  const beginFocus = (
    taskName?: string,
    choice: DurationChoice = durationChoice
  ) => {
    const minutes = resolveDuration(choice, untilMinutes);
    const name = resolveStartTask(taskName ?? taskDraft, loadLastTask(), recentTasks);
    const nextRecent = rememberTask(name, recentTasks);
    setRecentTasks(nextRecent);
    saveRecentTasks(nextRecent);
    saveLastTask(name);
    saveLastDuration(choice);
    setTaskDraft('');
    setStopConfirm(false);
    dismissCompleted();
    startFocus(minutes, name);
    dismissShortcutsCard();
    bumpHint('hover');
  };

  const handleOrbClick = () => {
    if (firstOpen) return;
    if (isBreak) return;
    if (isManualFocus) {
      setStopConfirm((open) => !open);
      return;
    }
    if (surface === 'in-meeting' || surface === 'meeting-soon') return;
    if (completed) {
      beginFocus(completed.task, durationChoice);
      return;
    }
    beginFocus(taskDraft, loadLastDuration() ?? durationChoice);
  };
  handleOrbClickRef.current = handleOrbClick;

  useEffect(() => {
    if (promptParam === 'done') {
      seedCompleted(taskParam || 'Deep work', Number(doneParam) || 50);
      if (taskParam) setTaskDraft(taskParam);
      return;
    }
    if (promptParam === 'break') {
      startBreak();
      return;
    }
    const minutes = Number(focusParam);
    if (promptParam === 'focus' || promptParam === 'stop' || (Number.isFinite(minutes) && minutes > 0)) {
      startFocus(
        Number.isFinite(minutes) && minutes > 0 ? minutes : 32.9,
        taskParam || 'Deep work'
      );
      if (promptParam === 'stop') setStopConfirm(true);
      if (taskParam) setTaskDraft(taskParam);
    }
  }, [doneParam, focusParam, promptParam, seedCompleted, startBreak, startFocus, taskParam]);

  useEffect(() => {
    if (untilMinutes != null && typeof durationChoice === 'number' && durationChoice > untilMinutes) {
      setDurationChoice('until');
    }
  }, [untilMinutes, durationChoice]);

  useEffect(() => {
    if (!isHeadsUp(day, now)) setSkipHeadsUp(false);
  }, [day, now]);

  useEffect(() => {
    if (settingsParam) setShowSettings(true);
  }, [settingsParam]);

  const triedPipRef = useRef(false);
  useEffect(() => {
    if (!miniOnly) {
      triedPipRef.current = false;
      return;
    }
    if (miniWindow.isOpen || !pipSupported || triedPipRef.current) return;
    triedPipRef.current = true;
    void miniWindow.open();
  }, [miniOnly, miniWindow.isOpen, miniWindow.open, pipSupported]);

  useEffect(() => {
    setShowAgenda(loadShowAgenda());
  }, []);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  return (
    <div 
      className={`relative h-screen w-screen overflow-hidden ${
        firstOpen ||
        showChrome ||
        orbHovered ||
        miniOnly ||
        surface === 'ask' ||
        surface === 'stop-confirm' ||
        surface === 'completed'
          ? ''
          : 'cursor-none'
      }`}
      data-satellites={day.remainingInRun.length}
      onMouseMove={(e) => {
        const over = isOverOrb(e.clientX, e.clientY);
        setOrbHovered(over);
        hoverBoostRef.current = over ? 1.12 : 1;
        if (!firstOpen) {
          setShowOverlay(true);
          if (overlayTimeoutRef.current) {
            clearTimeout(overlayTimeoutRef.current);
          }
          overlayTimeoutRef.current = setTimeout(() => {
            setShowOverlay(false);
          }, 3000);
        }
      }}
      onMouseLeave={() => {
        setShowOverlay(false);
        setOrbHovered(false);
        hoverBoostRef.current = 1;
        if (overlayTimeoutRef.current) {
          clearTimeout(overlayTimeoutRef.current);
        }
      }}
    >
      <title>{tabTitle}</title>
      <canvas
        ref={canvasRef}
        data-testid="orb-canvas"
        className={`absolute inset-0 ${miniOnly ? 'opacity-0' : ''} ${orbHovered && !firstOpen && !miniOnly ? 'cursor-pointer' : ''}`}
        onClick={(e) => {
          if (isOverOrb(e.clientX, e.clientY)) handleOrbClick();
        }}
      />

      {mountAgenda ? <Agenda sections={agendaSections} faded={agendaFaded} /> : null}

      {miniOnly ? (
        <button
          type="button"
          data-testid="floating-restore"
          onClick={() => setMiniOnly(false)}
          className="absolute inset-0 z-30 flex items-center justify-center text-[length:var(--type-status)] tracking-wide text-orb-quiet hover:text-orb-dim"
        >
          {FLOATING_RESTORE_LABEL}
        </button>
      ) : firstOpen ? (
        <Welcome
          googleConfigured={isGoogleConfigured()}
          onConnect={() => {
            if (isGoogleConfigured()) {
              calendar.selectAuthMethod('google');
              void signInWithGoogle();
              return;
            }
            setShowSettings(true);
          }}
        />
      ) : (
        <div
          ref={stackRef}
          data-testid="bottom-stack"
          className={`absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-[length:var(--stack-gap)] px-4 pb-[length:var(--stack-pad)] pt-1 ${
            showSettings ? 'invisible pointer-events-none' : ''
          }`}
        >
          {surface === 'in-meeting' || !surface ? (
            <StatusLine
              text={line}
              detail={hoverDetailText(day, now)}
              hovered={showOverlay || hoverParam}
              joinUrl={isHeadsUp(day, now) ? extractJoinUrl(day.nextEvent) : null}
            />
          ) : (
            <FocusPrompt
              surface={surface}
              contextLine={
                surface === 'meeting-soon' && day.nextEvent
                  ? formatMeetingSoonCopy(minutesBetween(now, day.nextEvent.start))
                  : statusLineText(day, now)
              }
              task={surface === 'focusing' || surface === 'stop-confirm' ? activeTask : taskDraft}
              onTaskChange={setTaskDraft}
              recentTasks={recentTasks}
              choice={durationChoice}
              onChoiceChange={(next) => {
                setDurationChoice(next);
                saveLastDuration(next);
              }}
              untilMinutes={untilMinutes}
              focusMinutes={manualTimeRemaining}
              completedTask={completed?.task}
              completedMinutes={completed?.minutes}
              joinUrl={extractJoinUrl(day.nextEvent)}
              onStart={() => beginFocus(taskDraft, durationChoice)}
              onKeepGoing={() => setStopConfirm(false)}
              onEnd={() => {
                setStopConfirm(false);
                stopFocus();
              }}
              onBreak={startBreak}
              onAnotherRound={() => beginFocus(completed?.task || taskDraft, durationChoice)}
              onJoin={() => {
                const url = extractJoinUrl(day.nextEvent);
                if (url) window.open(url, '_blank', 'noreferrer');
              }}
              onSkip={() => setSkipHeadsUp(true)}
              chromeVisible={showChrome}
              keyboardActive={!showSettings}
            />
          )}
          {calendar.mockScenario ? (
            <div
              data-testid="sample-day-label"
              className="text-[11px] tracking-wide text-orb-quiet"
            >
              {SAMPLE_DAY_LABEL}
            </div>
          ) : null}
          {showShortcutsCard ? (
            <StackBoundary>
              <ShortcutsCard onDismiss={dismissShortcutsCard} />
            </StackBoundary>
          ) : null}
          <Timeline
            events={day.events}
            now={now}
            hidden={surface === 'ask' || (isFullscreen && !showOverlay)}
          />
        </div>
      )}

      {miniOnly ? null : (
        <Satellites count={day.state === 'in-run' ? day.remainingInRun.length : 0} />
      )}

      {!firstOpen ? (
        <div
          className={`transition-opacity duration-300 ${
            showChrome
              ? 'visible opacity-100'
              : 'invisible pointer-events-none opacity-0'
          }`}
        >
          <div className="fixed top-4 right-4 z-40 flex items-center gap-1">
            {pipSupported ? (
              <>
                <button
                  type="button"
                  data-testid="pop-out"
                  onClick={() => {
                    if (miniWindow.isOpen) {
                      miniWindow.close();
                      setMiniOnly(false);
                    } else {
                      void miniWindow.open();
                    }
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[length:var(--type-chrome)] text-orb-quiet hover:text-orb-dim"
                  aria-pressed={miniWindow.isOpen}
                >
                  {POP_OUT_LABEL}
                  <KeyHint label="P" />
                </button>
                <button
                  type="button"
                  data-testid="mini-only"
                  onClick={async () => {
                    if (miniOnly) {
                      setMiniOnly(false);
                      return;
                    }
                    const ok = miniWindow.isOpen || (await miniWindow.open());
                    if (ok) setMiniOnly(true);
                  }}
                  className="px-3 py-1.5 text-[length:var(--type-chrome)] text-orb-quiet hover:text-orb-dim"
                  aria-pressed={miniOnly}
                >
                  {MINI_ONLY_LABEL}
                </button>
              </>
            ) : null}
            <button
              type="button"
              data-testid="fullscreen-toggle"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[length:var(--type-chrome)] text-orb-quiet hover:text-orb-dim"
              aria-label="Full screen"
              aria-pressed={isFullscreen}
            >
              {FULLSCREEN_LABEL}
              <KeyHint label="F" />
            </button>
            <button
              type="button"
              data-testid="settings-gear"
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[length:var(--type-chrome)] text-orb-quiet hover:text-orb-dim"
              aria-label="Settings"
            >
              ⚙
              <KeyHint label="S" />
            </button>
          </div>
        </div>
      ) : null}

      <Hints
        active={!firstOpen && !miniOnly}
        chromeVisible={showChrome}
        revision={hintRev}
        teach={surface === 'ask'}
        banner={
          !pipSupported && !firstOpen
            ? { id: 'chrome', text: CHROME_HINT }
            : leaveHint
              ? { id: 'leave-tab', text: LEAVE_TAB_HINT }
              : null
        }
      />

      {miniWindow.portal}

      {miniPreview ? (
        <div
          data-testid="mini-preview"
          className="pointer-events-auto fixed bottom-4 left-4 z-50 overflow-hidden"
          style={{ width: MINI_SIZE, height: MINI_SIZE }}
        >
          <MiniOrbView
            status={miniStatus}
            canvasRef={previewCanvasRef}
            onClick={() => handleOrbClickRef.current()}
          />
        </div>
      ) : null}
      
      {showSettings && (
        <Settings 
          onClose={() => setShowSettings(false)}
          calendarUrl={calendar.calendarUrl}
          setCalendarUrl={calendar.setCalendarUrl}
          scatterWindow={calendar.scatterWindow}
          setScatterWindow={calendar.setScatterWindow}
          authMethod={calendar.authMethod}
          selectAuthMethod={calendar.selectAuthMethod}
          isGoogleConnected={calendar.isGoogleConnected}
          disconnectGoogle={calendar.disconnectGoogle}
          calendars={calendar.calendars}
          selectedCalendarIds={calendar.selectedCalendarIds}
          toggleCalendar={calendar.toggleCalendar}
          pipSupported={pipSupported}
          popOutOnLeave={popOutOnLeave}
          setPopOutOnLeave={(value) => {
            setPopOutOnLeave(value);
            savePopOutOnLeave(value);
          }}
          showAgenda={showAgenda}
          setShowAgenda={(value) => {
            setShowAgenda(value);
            saveShowAgenda(value);
          }}
        />
      )}
    </div>
  );
}
