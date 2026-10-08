// Script to count dots in inner 0.4r disk at different scatter values
// Run with: npx tsx count-inner-dots.ts

const PARTICLE_COUNT = 135000;
const RADIUS = 1000; // Arbitrary unit

// Simulate point generation
function generatePoints() {
  const points: Array<{x: number, y: number, shade: number, threshold: number, escapeAt: number}> = [];
  
  const lightX = -0.55, lightY = -0.55, lightZ = 0.63;
  const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
  const Lx = lightX / lightLen, Ly = lightY / lightLen, Lz = lightZ / lightLen;
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = RADIUS * 1.35 * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const d = Math.sqrt(x * x + y * y) / RADIUS;
    
    const isInside = d < 1;
    const z = Math.sqrt(Math.max(0, 1 - d * d));
    const nx = x / RADIUS, ny = y / RADIUS;
    const lam = Math.max(0, Math.min(1, nx * Lx + ny * Ly + z * Lz));
    
    let shade: number;
    if (isInside) {
      shade = 0.06 + 0.84 * Math.pow(lam, 1.2);
    } else {
      const limbLam = Math.max(0, Math.min(1, nx * Lx + ny * Ly));
      const limbShade = Math.max(0.06 + 0.84 * Math.pow(limbLam, 1.2), 0.05);
      const distPastRim = d - 1;
      const lowerRightBias = Math.max(0, Math.min(1, 0.5 + 0.5 * (nx + ny) / Math.max(d, 1e-6) / 1.414));
      const k = 10 - 6 * lowerRightBias;
      shade = limbShade * Math.exp(-distPastRim * k);
    }
    
    const lowerRightBias = Math.max(0, Math.min(1, 0.5 + 0.5 * (nx + ny) / Math.max(d, 1e-6) / 1.414));
    const escapeAt = Math.max(0, Math.min(1, Math.random() - 0.35 * lowerRightBias * Math.min(d, 1.35) / 1.35));
    
    points.push({ x, y, shade, threshold: Math.random(), escapeAt });
  }
  
  return points;
}

function countInnerDots(points: Array<{x: number, y: number, shade: number, threshold: number, escapeAt: number}>, scatter: number) {
  const innerRadius = RADIUS * 0.4;
  let count = 0;
  
  for (const point of points) {
    const progress = scatter <= point.escapeAt ? 0 : (scatter - point.escapeAt) / (1 - point.escapeAt + 1e-6);
    
    let keepProb: number;
    if (progress === 0) {
      keepProb = point.shade * (1 - 0.55 * scatter);
    } else {
      keepProb = point.shade * (1 - 0.75 * progress);
    }
    
    if (point.threshold >= keepProb) continue;
    
    const dist = Math.sqrt(point.x * point.x + point.y * point.y);
    if (dist <= innerRadius) {
      count++;
    }
  }
  
  return count;
}

const points = generatePoints();
const count0 = countInnerDots(points, 0);
const count05 = countInnerDots(points, 0.5);
const count1 = countInnerDots(points, 1);

console.log(`Inner 0.4r disk dot counts:`);
console.log(`  scatter=0:   ${count0}`);
console.log(`  scatter=0.5: ${count05} (${(100 * count05 / count0).toFixed(1)}% of scatter-0)`);
console.log(`  scatter=1:   ${count1} (${(100 * count1 / count0).toFixed(1)}% of scatter-0)`);
console.log();
console.log(`Target: scatter-0.5 should have at least 50% of scatter-0 count`);
console.log(`Result: ${count05 >= count0 * 0.5 ? 'PASS ✓' : 'FAIL ✗'}`);
