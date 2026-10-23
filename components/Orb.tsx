'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
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
import { orbLayout, textClearCloudRadius, type OrbLayout } from '@/lib/layout';
import {
  DurationChoice,
  FALLBACK_TASK,
  type PromptSurface,
  formatMeetingSoonCopy,
  formatMiniFocusStatus,
  KEEP_FOCUSING_LABEL,
  KEEP_RESTING_LABEL,
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
import { CURSOR_HIDE_MS, isKeepCursorTarget, shouldHideCursor } from '@/lib/cursor';
import {
  clearFocusLog,
  focusLogKey,
  loadFocusLog,
  recordFocusLog,
  updateFocusLogEntry,
  type FocusLogEntry,
} from '@/lib/focusLog';
import {
  ORB_BLOOM_MS,
  ORB_BLOOM_PREVIEW_BEFORE,
  ORB_BLOOM_PREVIEW_SESSION,
  ORB_SETTLE_MS,
  attachGrowthFields,
  countedMinutesToday,
  formatFocusedToday,
  growthPointScale,
  isOrbPreviewKey,
  loadSettlePlayed,
  markSettlePlayed,
  orbVisualState,
  parseOrbFreeze,
  resolveDisplayMinutes,
  shouldPlaySettle,
  stageById,
  stageForMinutes,
  type OrbLook,
  type OrbMoment,
  type OrbPreviewKey,
  type OrbStage,
} from '@/lib/orbGrowth';
import { FocusLog } from './FocusLog';
import { collectTextClearRects, textClearAlpha, textClearRectsOnDisk } from '@/lib/textClear';
import {
  canUseDocumentPip,
  CHROME_HINT,
  FLOATING_RESTORE_LABEL,
  formatMiniStatus,
  LEAVE_TAB_HINT,
  loadPopOutOnLeave,
  MINI_SIZE,
  savePopOutOnLeave,
  scatterFromVisualInput,
} from '@/lib/miniOrb';
import {
  shouldRegeneratePoints,
  stepVisualScatter,
} from '@/lib/orbMotion';
import {
  isShortcutKey,
  loadShortcutsCardSeen,
  saveShortcutsCardSeen,
  shouldShowShortcutsCard,
} from '@/lib/shortcuts';
import { drawMiniOrbOnCanvas, ensureMiniCanvasSize } from '@/lib/drawMiniOrb';
import { sizeOrbCanvas } from '@/lib/orbCanvas';
import { useMiniWindow } from '@/components/useMiniWindow';
import { Settings } from './Settings';
import { Hints, markHintSeen } from './Hints';
import { Agenda } from './Agenda';
import { FocusPrompt } from './FocusPrompt';
import { StatusLine } from './StatusLine';
import { Timeline } from './Timeline';
import { Satellites } from './Satellites';
import { Welcome } from './Welcome';
import { FocusIntro } from './FocusIntro';
import { FocusSettle } from './FocusSettle';
import { MiniOrbView } from './MiniOrbView';
import { ShortcutsCard } from './ShortcutsCard';
import { isFirstOpen, isGoogleConfigured } from '@/lib/onboarding';
import {
  isStoredFocusRunning,
  loadIntroPlayed,
  loadIntroSound,
  loadPlayIntro,
  markIntroPlayed,
  parseIntroFreeze,
  saveIntroSound,
  savePlayIntro,
  shouldPlayIntro,
} from '@/lib/intro';
import {
  loadShowBackdrop,
  saveShowBackdrop,
} from '@/lib/backdrop';
import { SAMPLE_DAY_LABEL } from '@/lib/fixtures';
import { signInWithGoogleCalendar } from '@/app/actions';
import { LegalLinks } from './LegalLinks';
import { formatWhoopWindow, recordWhoopNudge, whoopBestWindow } from '@/lib/whoop';
import { useWhoop } from '@/lib/useWhoop';
import { StarDustBackdrop } from './StarDustBackdrop';
import { VoiceMicButton, VoiceOverlay } from './VoiceOverlay';
import { parseVoiceQuery, useVoiceStart, type VoicePending } from '@/lib/useVoiceStart';
import { track } from '@/lib/track';

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
  const plannedParam = searchParams.get('planned');
  const introParam = searchParams.get('intro');
  const introFreeze = parseIntroFreeze(searchParams.get('t'));
  const voiceMock = parseVoiceQuery(searchParams.get('voice'));
  const orbParam = searchParams.get('orb');
  const mockOrb = searchParams.get('mock');
  const orbFromMock = mockOrb?.startsWith('orb-') ? mockOrb.slice(4) : null;
  const orbPreview: OrbPreviewKey | null = isOrbPreviewKey(orbParam)
    ? orbParam
    : isOrbPreviewKey(orbFromMock)
      ? orbFromMock
      : null;
  const settleParam = searchParams.get('settle');
  const orbFreeze = parseOrbFreeze(searchParams.get('orbT'));
  const orbMinutesParam = searchParams.get('orbMinutes');
  const whoop = useWhoop();
  const pipSupported = useSyncExternalStore(
    () => () => {},
    () => canUseDocumentPip() && !forceUnsupported,
    () => false
  );
  
  const [scatter, setScatter] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [sessionConfirm, setSessionConfirm] = useState(false);
  const [hideCursor, setHideCursor] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);
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
  const [showBackdrop, setShowBackdrop] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [bloomDone, setBloomDone] = useState(true);
  const [nextStep, setNextStep] = useState('');
  const [distracted, setDistracted] = useState<boolean | null>(null);
  const [focusRating, setFocusRating] = useState<number | null>(null);
  const [playIntro, setPlayIntro] = useState(true);
  const [introSound, setIntroSound] = useState(true);
  const [viewSize, setViewSize] = useState({ w: 1280, h: 800 });
  const overlayTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const cursorTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleOrbClickRef = useRef<() => void>(() => {});
  const miniOnlyRef = useRef(false);
  const firstOpenRef = useRef(false);
  const settingsOpenRef = useRef(false);
  const logOpenRef = useRef(false);
  const introOpenRef = useRef(false);
  const settleOpenRef = useRef(false);
  const settleSkippedRef = useRef(false);
  const lastLogIdRef = useRef<string | null>(null);
  const nowRef = useRef(new Date());
  const sessionFromRef = useRef<OrbStage | null>(null);
  const bloomFromRef = useRef<OrbStage | null>(null);
  const bloomToRef = useRef<OrbStage | null>(null);
  const growthClockRef = useRef({ moment: 'still' as OrbMoment, startedAt: 0 });
  const growthRef = useRef({
    moment: 'still' as OrbMoment,
    minutes: 0,
    fromStage: stageForMinutes(0),
    toStage: stageForMinutes(0),
    freezeMs: null as number | null,
    reducedMotion: false,
    startedAt: 0,
  });
  const showBackdropRef = useRef(true);
  const startedByVoiceRef = useRef(false);
  const surfaceRef = useRef<PromptSurface | null>(null);
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
  nowRef.current = now;
  const logKey = focusLogKey({
    email: calendar.userEmail,
    mock: Boolean(calendar.mockScenario),
  });
  const logKeyRef = useRef(logKey);
  logKeyRef.current = logKey;

  useEffect(() => {
    setFocusLog(loadFocusLog(logKey));
  }, [logKey]);
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
    endSession,
    dismissCompleted,
    seedCompleted,
  } = useManualFocus({
    onFocusEnded: (draft) => {
      const enriched = attachGrowthFields(draft, {
        entries: loadFocusLog(logKeyRef.current),
        now: nowRef.current,
        settleSkipped: settleSkippedRef.current,
      });
      const next = recordFocusLog(logKeyRef.current, enriched);
      lastLogIdRef.current = next[0]?.id ?? null;
      bloomFromRef.current = stageById(enriched.stageBefore ?? 0);
      bloomToRef.current = stageById(enriched.stageAfter ?? 0);
      setBloomDone(false);
      setNextStep('');
      setDistracted(null);
      setFocusRating(null);
      setFocusLog(next);
      if (draft.ended === 'ended-session') return;
      track({
        name: 'block_completed',
        minutes: Math.max(0, Math.round(draft.minutes)),
        source: startedByVoiceRef.current ? 'voice' : 'manual',
      });
    },
  });

  useLiveTab({
    model: day,
    scatter,
    isManualFocus,
  });

  const firstOpen = isFirstOpen({
    mockScenario: calendar.mockScenario,
    isGoogleConnected: calendar.isGoogleConnected,
    calendarUrl: calendar.calendarUrl,
    authMethod: calendar.authMethod,
    whoopDemo: whoop.demo,
    homePreview: Boolean(orbPreview),
  });

  const showChrome =
    !firstOpen && !miniOnly && !showSettings && !showLog && (showOverlay || hoverParam);

  const surface = promptSurface({
    firstOpen,
    miniOnly,
    isFocusing: isManualFocus,
    isBreak: Boolean(isBreak),
    stopConfirm,
    sessionConfirm,
    completed: Boolean(completed),
    headsUp: isHeadsUp(day, now),
    skipHeadsUp,
    dayState: day.state,
  });
  const untilMinutes = untilMeetingDuration(day);
  const activeTask = sessionTask || taskDraft || loadLastTask() || FALLBACK_TASK;
  const whoopWindow = (() => {
    const facts = whoop.summary?.facts;
    if (!facts) return null;
    const window = whoopBestWindow(facts, day.gaps, now);
    return window ? formatWhoopWindow(window.start, window.end) : null;
  })();

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
    onClosed: () => {
      setMiniOnly(false);
    },
  });

  miniOnlyRef.current = miniOnly;
  askDimRef.current =
    surface === 'ask' ||
    surface === 'completed' ||
    surface === 'break' ||
    (surface === 'session-confirm' && Boolean(isBreak));
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
  const logMinutes = countedMinutesToday(focusLog, now);
  const displayMinutes = resolveDisplayMinutes({
    logMinutes,
    preview: orbPreview,
    orbMinutesParam,
  });
  const liveStage = stageForMinutes(displayMinutes);
  const focusingNow = isManualFocus || surface === 'stop-confirm';
  const blooming = Boolean(completed) && !bloomDone;
  const growthMoment: OrbMoment = showSettle
    ? 'settle'
    : blooming
      ? 'bloom'
      : focusingNow
        ? 'focusing'
        : 'still';
  const fromStage =
    growthMoment === 'bloom'
      ? (bloomFromRef.current ?? liveStage)
      : growthMoment === 'focusing'
        ? (sessionFromRef.current ?? liveStage)
        : liveStage;
  const toStage =
    growthMoment === 'bloom' ? (bloomToRef.current ?? liveStage) : liveStage;
  if (growthClockRef.current.moment !== growthMoment) {
    growthClockRef.current = { moment: growthMoment, startedAt: performance.now() };
  }
  growthRef.current = {
    moment: growthMoment,
    minutes: displayMinutes,
    fromStage,
    toStage,
    freezeMs: orbFreeze == null ? null : orbFreeze * 1000,
    reducedMotion,
    startedAt: growthClockRef.current.startedAt,
  };
  const previewVisual = orbVisualState({
    minutes: displayMinutes,
    moment: growthMoment,
    elapsedMs: orbFreeze == null ? 0 : orbFreeze * 1000,
    reducedMotion,
    fromStage,
    toStage,
    preview: orbPreview,
  });

  const focusingSurface = surface === 'focusing' || surface === 'stop-confirm';
  const idleAgendaSurface =
    surface === 'ask' ||
    surface === 'break' ||
    surface === 'completed' ||
    surface === 'meeting-soon' ||
    surface === 'session-confirm' ||
    surface === 'in-meeting';
  const mountAgenda =
    showAgenda &&
    !firstOpen &&
    !miniOnly &&
    !showSettle &&
    !showSettings &&
    !showLog &&
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
    const stack = stackRef.current;
    const text = stack?.querySelector<HTMLElement>(
      '[data-testid="prompt-context"], [data-testid="focus-task-name"], [data-testid="meeting-soon-prompt"], [data-text-clear]'
    );
    const textTop = text?.getBoundingClientRect().top ?? stack?.getBoundingClientRect().top ?? viewH;
    layoutRef.current = orbLayout(viewW, viewH, Math.max(0, viewH - textTop));
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

  useLayoutEffect(() => {
    const play = shouldPlayIntro({
      introParam,
      sessionPlayed: loadIntroPlayed(),
      playIntro: loadPlayIntro(),
      focusing: isStoredFocusRunning(),
      miniOnly: miniOnlyParam,
    });
    if (play) markIntroPlayed();
    setShowIntro(play);
    setPlayIntro(loadPlayIntro());
    setIntroSound(loadIntroSound());
    const playSettle = shouldPlaySettle({
      settleParam,
      preview: orbPreview,
      sessionPlayed: loadSettlePlayed(),
      introOpen: play,
      focusing: isStoredFocusRunning(),
      miniOnly: miniOnlyParam,
      firstOpen: false,
    });
    if (playSettle) {
      markSettlePlayed();
      setShowSettle(true);
    } else {
      setShowSettle(false);
    }
  }, [introParam, miniOnlyParam, orbPreview, settleParam]);

  const finishSettle = useCallback((skipped: boolean) => {
    settleSkippedRef.current = skipped || settleSkippedRef.current;
    markSettlePlayed();
    setShowSettle(false);
  }, []);

  useEffect(() => {
    if (firstOpen && showSettle) setShowSettle(false);
  }, [firstOpen, showSettle]);

  useEffect(() => {
    if (!showSettle || orbFreeze != null) return;
    const timer = window.setTimeout(() => finishSettle(false), ORB_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [finishSettle, orbFreeze, showSettle]);

  useEffect(() => {
    if (!completed || bloomDone || orbFreeze != null) return;
    const timer = window.setTimeout(() => setBloomDone(true), ORB_BLOOM_MS);
    return () => window.clearTimeout(timer);
  }, [bloomDone, completed, orbFreeze]);

  useEffect(() => {
    if (orbPreview !== 'bloom') return;
    seedCompleted('Deep work', ORB_BLOOM_PREVIEW_SESSION, ORB_BLOOM_PREVIEW_SESSION);
    bloomFromRef.current = stageForMinutes(ORB_BLOOM_PREVIEW_BEFORE);
    bloomToRef.current = stageForMinutes(ORB_BLOOM_PREVIEW_BEFORE + ORB_BLOOM_PREVIEW_SESSION);
    setBloomDone(false);
  }, [orbPreview, seedCompleted]);

  const patchLastLog = useCallback(
    (patch: Partial<FocusLogEntry>) => {
      const id = lastLogIdRef.current;
      if (!id) return;
      setFocusLog(updateFocusLogEntry(logKeyRef.current, id, patch));
    },
    []
  );

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

  useEffect(() => {
    if (whoop.mode !== 'adapt' || whoop.offerMinutes == null) return;
    setDurationChoice(whoop.offerMinutes);
  }, [whoop.mode, whoop.offerMinutes]);

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
    
    const ctx = canvas.getContext('2d', { alpha: true });
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
    
    let lastTs = 0;

    const paintMini = (visualScatter: number, look: OrbLook, breath: number) => {
      const frame = miniDrawRef.current;
      const payload = {
        scatter: visualScatter,
        density: frame.density,
        dim: frame.dim,
        scale: look.scale * breath,
        glow: look.glow,
        halo: look.halo,
        brightness: look.brightness,
        warmth: look.warmth,
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
      const growth = growthRef.current;
      const elapsed =
        growth.freezeMs != null ? growth.freezeMs : ts - growth.startedAt;
      const visual = orbVisualState({
        minutes: growth.minutes,
        moment: growth.moment,
        elapsedMs: elapsed,
        reducedMotion: growth.reducedMotion,
        fromStage: growth.fromStage,
        toStage: growth.toStage,
      });
      const look = visual.look;
      const debugGrowth = window as Window & {
        __orbGrowth?: {
          stage: string;
          minutes: number;
          moment: OrbMoment;
          scale: number;
        };
      };
      debugGrowth.__orbGrowth = {
        stage: visual.stage.key,
        minutes: visual.minutes,
        moment: visual.moment,
        scale: look.scale * visual.breath,
      };
      
      if (showBackdropRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (miniOnlyRef.current) {
        paintMini(visualScatter, look, visual.breath);
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      const glowColor = `${255}, ${Math.round(255 - 12 * look.warmth)}, ${Math.round(255 - 28 * look.warmth)}`;
      if (look.glow > 0) {
        const glow = look.glow;
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          radius * 0.18 * look.scale,
          centerX,
          centerY,
          radius * (1.15 + 0.35 * glow) * look.scale
        );
        gradient.addColorStop(0, `rgba(${glowColor},${0.16 * glow})`);
        gradient.addColorStop(1, `rgba(${glowColor},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (look.halo > 0) {
        const ring = ctx.createRadialGradient(
          centerX,
          centerY,
          radius * 0.95 * look.scale,
          centerX,
          centerY,
          radius * (1.55 + 0.2 * look.halo) * look.scale
        );
        ring.addColorStop(0, `rgba(${glowColor},0)`);
        ring.addColorStop(0.55, `rgba(${glowColor},${0.14 * look.halo})`);
        ring.addColorStop(1, `rgba(${glowColor},0)`);
        ctx.fillStyle = ring;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Re-randomize a small fraction of thresholds for shimmer effect
      if (Math.random() < 0.01) {
        const idx = Math.floor(Math.random() * pointsRef.current.length);
        pointsRef.current[idx].threshold = Math.random();
      }
      
      // Safety net only: clear text that the scatter cloud actually reaches.
      const clearRects = textClearRectsOnDisk(collectTextClearRects(), {
        centerX: layout.centerX,
        centerY: layout.centerY,
        radius: textClearCloudRadius(layout.radius * look.scale, visualScatter),
      });
      ctx.fillStyle = '#ffffff';
      
      for (const point of pointsRef.current) {
        // Per-point escape model
        const progress = visualScatter <= point.escapeAt 
          ? 0 
          : Math.min(1, (visualScatter - point.escapeAt) / (1 - point.escapeAt + 1e-6));
        
        // Keep probability based on escape state.
        // Gap-aware brightness scales only the starting keep probability.
        const startingKeep = point.shade * densityRef.current * hoverBoost * look.brightness;
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
        
        const pointRadius = Math.hypot(point.x, point.y) / Math.max(radius, 1);
        const pointScale = growthPointScale(look, visual.breath, pointRadius);
        let x = point.x * pointScale;
        let y = point.y * pointScale;
        
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
      
      // Dim the orb disk during a meeting, or quietly while asking.
      // Keep it radial so star-dust corners stay visible.
      if (
        (inBusyRef.current || askDimRef.current) &&
        !miniOnlyRef.current
      ) {
        const alpha = inBusyRef.current ? 0.75 : 0.42;
        const veil = ctx.createRadialGradient(
          centerX,
          centerY,
          radius * 0.7,
          centerX,
          centerY,
          radius * 1.28
        );
        veil.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
        veil.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      paintMini(visualScatter, look, visual.breath);
      
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

  const beginVoiceFocus = useCallback(
    (next: VoicePending) => {
      startedByVoiceRef.current = true;
      const name = resolveStartTask(next.label, loadLastTask(), recentTasks);
      const nextRecent = rememberTask(name, recentTasks);
      setRecentTasks(nextRecent);
      saveRecentTasks(nextRecent);
      saveLastTask(name);
      saveLastDuration(next.minutes);
      if (whoop.offerMinutes != null) {
        recordWhoopNudge(whoop.suggestion?.lineKey ?? null, next.minutes, whoop.offerMinutes);
      }
      setTaskDraft('');
      setStopConfirm(false);
      setSessionConfirm(false);
      dismissCompleted();
      startFocus(next.minutes, name);
      dismissShortcutsCard();
    },
    [dismissCompleted, dismissShortcutsCard, recentTasks, startFocus, whoop.offerMinutes, whoop.suggestion?.lineKey]
  );

  const voice = useVoiceStart({
    enabled: !firstOpen && !miniOnly && !showSettings && !showLog && !showIntro,
    mock: Boolean(voiceMock),
    gapMinutes: day.gapMinutes,
    nextEventTitle: day.nextEvent?.summary ?? null,
    whoopOfferMinutes: whoop.mode === 'off' ? null : whoop.offerMinutes,
    onStart: beginVoiceFocus,
  });

  useEffect(() => {
    if (
      showIntro ||
      showSettle ||
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
  }, [firstOpen, miniOnly, showIntro, showSettle, surface]);

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

  const togglePopOut = () => {
    if (!pipSupported) return;
    if (miniWindow.isOpen) {
      miniWindow.close();
      setMiniOnly(false);
    } else {
      void miniWindow.open();
    }
  };

  const toggleMiniOnly = async () => {
    if (!pipSupported) return;
    if (miniOnly) {
      setMiniOnly(false);
      return;
    }
    const ok = miniWindow.isOpen || (await miniWindow.open());
    if (ok) setMiniOnly(true);
  };

  const openLog = () => {
    setShowSettings(false);
    setShowLog(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (introOpenRef.current || settleOpenRef.current) return;
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
        e.preventDefault();
        togglePopOut();
      } else if (e.key === 'm' || e.key === 'M') {
        if (!pipSupported) return;
        e.preventDefault();
        if (miniOnlyRef.current) {
          setMiniOnly(false);
          return;
        }
        void Promise.resolve(miniWindow.isOpen || miniWindow.open()).then((ok) => {
          if (ok) setMiniOnly(true);
        });
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        if (logOpenRef.current) {
          setShowLog(false);
          return;
        }
        openLog();
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
    startedByVoiceRef.current = false;
    const minutes = resolveDuration(choice, untilMinutes);
    const name = resolveStartTask(taskName ?? taskDraft, loadLastTask(), recentTasks);
    const nextRecent = rememberTask(name, recentTasks);
    setRecentTasks(nextRecent);
    saveRecentTasks(nextRecent);
    saveLastTask(name);
    saveLastDuration(choice);
    if (whoop.offerMinutes != null) {
      recordWhoopNudge(whoop.suggestion?.lineKey ?? null, minutes, whoop.offerMinutes);
    }
    setTaskDraft('');
    setStopConfirm(false);
    setSessionConfirm(false);
    dismissCompleted();
    sessionFromRef.current = stageForMinutes(
      resolveDisplayMinutes({
        logMinutes: countedMinutesToday(loadFocusLog(logKeyRef.current), nowRef.current),
        preview: orbPreview,
        orbMinutesParam,
      })
    );
    startFocus(minutes, name);
    dismissShortcutsCard();
    bumpHint('hover');
  };

  const handleOrbClick = () => {
    if (firstOpen) return;
    if (showSettle) {
      finishSettle(true);
      return;
    }
    if (isBreak) {
      setSessionConfirm((open) => !open);
      return;
    }
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
      seedCompleted(
        taskParam || 'Deep work',
        Number(doneParam) || 50,
        Number(plannedParam) || Number(doneParam) || 50
      );
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
  }, [doneParam, focusParam, plannedParam, promptParam, seedCompleted, startBreak, startFocus, taskParam]);

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
    setShowBackdrop(loadShowBackdrop());
  }, []);

  useEffect(() => {
    const onFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setHideCursor(false);
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  firstOpenRef.current = firstOpen;
  settingsOpenRef.current = showSettings;
  logOpenRef.current = showLog;
  introOpenRef.current = showIntro;
  settleOpenRef.current = showSettle;
  showBackdropRef.current = showBackdrop;
  surfaceRef.current = surface;
  miniOnlyRef.current = miniOnly;

  useEffect(() => {
    setHideCursor(false);
  }, [surface, showSettings, showLog, firstOpen, miniOnly]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const overInteractive = isKeepCursorTarget(event.target);
      setHideCursor(false);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = setTimeout(() => {
        setHideCursor(
          shouldHideCursor({
            surface: surfaceRef.current,
            stillMs: CURSOR_HIDE_MS,
            overInteractive,
            firstOpen: firstOpenRef.current,
            miniOnly: miniOnlyRef.current,
            settingsOpen: settingsOpenRef.current,
            logOpen: logOpenRef.current,
          })
        );
      }, CURSOR_HIDE_MS);
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
    };
  }, []);

  return (
    <div 
      data-testid="orb-root"
      data-orb-stage={previewVisual.stage.key}
      data-orb-moment={growthMoment}
      data-orb-minutes={String(Math.round(displayMinutes))}
      data-log-open={showLog ? 'true' : 'false'}
      data-backdrop={showBackdrop ? 'true' : 'false'}
      data-cursor-hidden={hideCursor ? 'true' : 'false'}
      className={`relative h-screen w-screen overflow-hidden bg-black ${hideCursor ? 'cursor-none' : ''}`}
      data-satellites={day.remainingInRun.length}
      onMouseMove={(e) => {
        const over = isOverOrb(e.clientX, e.clientY);
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
        hoverBoostRef.current = 1;
        if (overlayTimeoutRef.current) {
          clearTimeout(overlayTimeoutRef.current);
        }
      }}
    >
      <StarDustBackdrop enabled={showBackdrop} />
      {!miniOnly && !showSettings && !showLog && !firstOpen ? (
        <div className="absolute left-4 top-4 z-20">
          <LegalLinks testId="home-legal" current="home" />
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        data-testid="orb-canvas"
        className={`absolute inset-0 z-[1] ${miniOnly ? 'opacity-0' : ''}`}
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
              void signInWithGoogleCalendar();
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
          {showSettle ? (
            <FocusSettle onSkip={finishSettle} />
          ) : surface === 'in-meeting' || !surface ? (
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
              whoopLine={surface === 'ask' ? whoop.line : null}
              whoopWindow={surface === 'ask' && whoop.line ? whoopWindow : null}
              whoopOfferMinutes={surface === 'ask' && whoop.mode !== 'off' ? whoop.offerMinutes : null}
              whoopAdapt={whoop.mode === 'adapt'}
              onHideWhoopLine={whoop.hideLine}
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
              completedPlanned={completed?.planned}
              focusedToday={
                completed ? formatFocusedToday(displayMinutes) : null
              }
              blooming={blooming}
              nextStep={nextStep}
              onNextStepChange={(value) => {
                setNextStep(value);
                patchLastLog({ nextStep: value });
              }}
              distracted={distracted}
              onDistracted={(value) => {
                setDistracted(value);
                patchLastLog({ distracted: value });
              }}
              focusRating={focusRating}
              onFocusRating={(value) => {
                setFocusRating(value);
                patchLastLog({ focusRating: value });
              }}
              joinUrl={extractJoinUrl(day.nextEvent)}
              onStart={(taskName, choice) =>
                beginFocus(taskName ?? taskDraft, choice ?? durationChoice)
              }
              onKeepGoing={() => setStopConfirm(false)}
              onEnd={() => {
                setStopConfirm(false);
                stopFocus();
              }}
              onBreak={() => startBreak(whoop.breakMinutes ?? undefined)}
              onAnotherRound={() => beginFocus(completed?.task || taskDraft, durationChoice)}
              onJoin={() => {
                const url = extractJoinUrl(day.nextEvent);
                if (url) window.open(url, '_blank', 'noreferrer');
              }}
              onSkip={() => setSkipHeadsUp(true)}
              onOpenSession={() => setSessionConfirm(true)}
              onKeepSession={() => setSessionConfirm(false)}
              onEndSession={() => {
                setSessionConfirm(false);
                setStopConfirm(false);
                endSession();
              }}
              sessionKeepLabel={isBreak ? KEEP_RESTING_LABEL : KEEP_FOCUSING_LABEL}
              chromeVisible={showChrome}
              keyboardActive={!showSettings && !showLog}
              onOpenLog={() => {
                setShowSettings(false);
                setShowLog(true);
              }}
            />
          )}
          {calendar.mockScenario ? (
            <div
              data-testid="sample-day-label"
              data-text-clear
              className="text-[11px] tracking-wide text-orb-quiet"
            >
              {SAMPLE_DAY_LABEL}
            </div>
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

      {showShortcutsCard ? <ShortcutsCard onDismiss={dismissShortcutsCard} /> : null}

      <Hints
        active={!firstOpen && !miniOnly && !showShortcutsCard}
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
        onAction={(id) => {
          if (id === 'fullscreen') toggleFullscreen();
          else if (id === 'settings') setShowSettings(true);
          else if (id === 'focus') handleOrbClickRef.current();
          else if (id === 'pop-out') togglePopOut();
          else if (id === 'mini-only') void toggleMiniOnly();
          else if (id === 'log') openLog();
        }}
      />

      <VoiceMicButton
        visible={!firstOpen && !miniOnly && !showSettings && !showLog && !showIntro && !showShortcutsCard}
        holding={voice.phase === 'listening'}
        onHoldStart={voice.holdStart}
        onHoldEnd={voice.holdEnd}
      />
      <VoiceOverlay
        phase={voice.phase}
        liveTranscript={voice.liveTranscript}
        mock={voice.mock}
        mockInput={voice.mockInput}
        onMockChange={voice.setMockInput}
        onMockSubmit={voice.submitMock}
        pending={voice.pending}
        conflict={voice.conflict}
        errorKind={voice.errorKind}
        repeatMessage={voice.repeatMessage}
        typedInput={voice.typedInput}
        onTypedChange={voice.setTypedInput}
        onTypedSubmit={voice.submitTyped}
        onCancel={voice.cancelConfirm}
        onYes={voice.conflictYes}
        onNo={voice.conflictNo}
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
          defaultDuration={durationChoice}
          setDefaultDuration={setDurationChoice}
          userEmail={calendar.userEmail}
          showAgenda={showAgenda}
          setShowAgenda={(value) => {
            setShowAgenda(value);
            saveShowAgenda(value);
          }}
          showBackdrop={showBackdrop}
          setShowBackdrop={(value) => {
            setShowBackdrop(value);
            saveShowBackdrop(value);
          }}
          onClearLog={() => setFocusLog(clearFocusLog(logKey))}
          playIntro={playIntro}
          setPlayIntro={(value) => {
            setPlayIntro(value);
            savePlayIntro(value);
          }}
          introSound={introSound}
          setIntroSound={(value) => {
            setIntroSound(value);
            saveIntroSound(value);
          }}
          whoopConnected={Boolean(whoop.summary?.connected)}
          whoopStatus={whoop.summary?.status ?? 'disconnected'}
          whoopMode={whoop.mode}
          setWhoopMode={whoop.setMode}
          whoopShowNumbers={whoop.showNumbers}
          setWhoopShowNumbers={whoop.setShowNumbers}
          onWhoopConnect={whoop.connect}
          onWhoopDisconnect={whoop.disconnect}
          whoopMessage={whoop.message}
        />
      )}

      {showIntro ? (
        <FocusIntro
          soundEnabled={introSound}
          reducedMotion={reducedMotion}
          freezeAt={introFreeze}
          onDone={() => {
            setShowIntro(false);
            if (
              shouldPlaySettle({
                settleParam,
                preview: orbPreview,
                sessionPlayed: loadSettlePlayed(),
                introOpen: false,
                focusing: isStoredFocusRunning(),
                miniOnly: miniOnlyParam,
                firstOpen,
              })
            ) {
              markSettlePlayed();
              setShowSettle(true);
            }
          }}
        />
      ) : null}

      {showLog ? (
        <FocusLog
          entries={focusLog}
          now={now}
          onClose={() => setShowLog(false)}
          onPickTask={(task) => {
            setTaskDraft(task);
            setShowLog(false);
          }}
        />
      ) : null}
    </div>
  );
}
