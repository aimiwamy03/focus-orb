/**
 * Calculate scatter value (0..1) based on time to next event.
 * 
 * @param minutesToStart - Minutes until the event starts (negative if event started)
 * @param scatterWindow - Minutes before event when scatter starts ramping (15/30/60/90)
 * @returns scatter value: 0 (tight/bright) to 1 (scattered/dim)
 */
export function calculateScatter(
  minutesToStart: number,
  scatterWindow: number = 60
): number {
  // During or past event: return high scatter (dim state)
  if (minutesToStart <= 0) {
    return 1;
  }
  
  // Far from event: no scatter
  if (minutesToStart >= scatterWindow) {
    return 0;
  }
  
  // Ramp from 0 to 1 as we approach the event
  // Ease-in curve: slower at start, faster near event
  const progress = 1 - minutesToStart / scatterWindow;
  return easeIn(progress);
}

/**
 * Calculate scatter for manual focus blocks.
 * Ramps over the last portion of the block (last 40%, capped at window).
 * 
 * @param minutesRemaining - Minutes remaining in the focus block
 * @param totalMinutes - Total duration of the focus block
 * @param maxWindow - Maximum scatter window in minutes (default 60)
 * @returns scatter value: 0 (tight/bright) to 1 (scattered/dim)
 */
export function calculateManualScatter(
  minutesRemaining: number,
  totalMinutes: number,
  maxWindow: number = 60
): number {
  if (minutesRemaining <= 0) {
    return 1;
  }
  
  // Ramp window is the last 40% of the block, capped at maxWindow
  const rampWindow = Math.min(totalMinutes * 0.4, maxWindow);
  
  // No scatter if we're before the ramp window
  if (minutesRemaining > rampWindow) {
    return 0;
  }
  
  // Ramp from 0 to 1 over the ramp window
  const progress = 1 - minutesRemaining / rampWindow;
  return easeIn(progress);
}

/**
 * Ease-in interpolation: slow start, fast end
 */
function easeIn(t: number): number {
  return t * t * t;
}

/**
 * Format minutes as "Xh Ym" or "Ym"
 */
export function formatTimeRemaining(minutes: number): string {
  if (minutes < 0) return 'now';
  if (minutes < 1) return '< 1m';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

/**
 * Format minutes for tab title (compact)
 */
export function formatTabTitle(minutes: number): string {
  if (minutes < 0) return '● now';
  if (minutes < 1) return '● <1m';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  
  if (hours > 0) {
    return `● ${hours}h${mins}m`;
  }
  return `● ${mins}m`;
}
