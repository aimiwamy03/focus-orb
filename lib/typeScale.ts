export interface FluidType {
  min: number;
  vw: number;
  add: number;
  max: number;
}

/** Fluid type used in CSS clamp(). Preferred size = vw% of width + add. */
export const TYPE_SCALE = {
  heading: { min: 22, vw: 1.4, add: 12, max: 30 },
  input: { min: 18, vw: 1.1, add: 10, max: 24 },
  status: { min: 15, vw: 0.55, add: 11, max: 18 },
  chip: { min: 15, vw: 0.55, add: 11, max: 18 },
  button: { min: 15, vw: 0.55, add: 11, max: 18 },
  hint: { min: 14, vw: 0.2, add: 13, max: 15 },
  chrome: { min: 15, vw: 0.15, add: 13.5, max: 16 },
  key: { min: 14, vw: 0, add: 14, max: 14 },
  logHeading: { min: 26, vw: 0.2, add: 25, max: 28 },
  logBody: { min: 17, vw: 0.15, add: 16, max: 18 },
} as const satisfies Record<string, FluidType>;

export function fluidPx(rule: FluidType, viewW: number): number {
  return Math.min(rule.max, Math.max(rule.min, (rule.vw * viewW) / 100 + rule.add));
}

export function clampCss(rule: FluidType): string {
  return `clamp(${rule.min}px, ${rule.vw}vw + ${rule.add}px, ${rule.max}px)`;
}
