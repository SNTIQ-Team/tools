/**
 * Relief: WebGL2 surfaces under studio light. The hero and reading-page bands
 * share one folded-surface shader whose presets interpolate linearly; the four
 * Deutschland Together modules render their own procedural material shaders
 * (moduleMaterials.ts) and cross via fold.ts on a single WebGL2 context.
 *
 * Built to stay cheap on weak hardware:
 *  - one pass, no textures, high-frequency grain faded with adaptive scale;
 *  - starts within a pixel budget, climbs to native resolution while frames
 *    stay fast, steps down (and stays down) when they do not, then halves
 *    its frame rate;
 *  - draws nothing while off screen, in a hidden tab or paused.
 * Without WebGL2 the caller keeps its CSS background / static .webp fallback.
 */
import { lerpPreset, renderSize, type ReliefPreset } from './motionMath';
import { foldHeight, stepFold, type FoldState } from './fold';
import { isModuleMaterial, moduleFragmentShader, type ModuleMaterialId } from './moduleMaterials';

export type ReliefName = 'hero' | 'page' | 'kerf' | 'taper' | 'chamfer' | 'lathe';
export type ReliefSurface = 'stage' | 'band';

const VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_ptr;
uniform vec4 u_a;   // fan centre x, y · number of folds · twist
uniform vec4 u_b;   // flow · swell · share of rings · ring and weave frequency
uniform vec4 u_c;   // exposure · focus x, y · grain
uniform vec4 u_d;   // facets · terraces · weave · weave angle
uniform vec4 u_e;   // light colour r, g, b · rim light strength
uniform vec4 u_f;   // shadow colour r, g, b · drift of the folds per second
uniform vec4 u_g;   // rim light colour r, g, b · unused
uniform float u_amp; // height of the folds, 0 while one surface turns into another
uniform float u_px;  // rendered pixels per device pixel, 1 at native resolution
uniform float u_quality; // 0..1 adaptive shader detail for GPU vs weak/software renderers
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

float height(vec2 p, out float ridge) {
  float t = u_time;
  vec2 q = p + u_b.x * 0.38 * vec2(
    sin(p.y * 1.05 + t * 0.145) + 0.5 * sin(p.y * 2.10 + p.x * 0.70 - t * 0.095),
    cos(p.x * 0.90 - t * 0.120) + 0.5 * cos(p.x * 1.90 - p.y * 0.60 + t * 0.080));
  vec2 c = q - u_a.xy;
  float r = length(c);
  float ang = atan(c.y, c.x);
  float ph = mix(ang * u_a.z, r * u_b.w, u_b.z)
           + u_a.w * sin(r * 1.30 - t * 0.16 + ang * 2.0)
           + u_f.w * t;
  // Every crease is softened by the width of one pixel in phase units, so a
  // fold that gets thin never breaks into steps.
  float aa = min(fwidth(ph), 1.2);
  float s = sin(ph);
  float prof = sqrt(s * s + 0.0025 + aa * aa * 0.30);          // round crest, sharp valley
  // Uniform branches skip facets, terraces, and weave entirely on the Hero/Page presets (2x faster on mobile GPUs).
  if (u_d.x > 0.001) {
    float tri = acos((1.0 - clamp(0.0006 + aa * aa * 0.45, 0.0, 0.5)) * cos(2.0 * ph)) / 3.14159;
    prof = mix(prof, tri, u_d.x);
  }
  if (u_d.y > 0.001) {
    float f = fract(ph / 3.14159);
    float edge = max(0.10, aa * 0.75);
    float ter = smoothstep(0.0, 0.86, f) * (1.0 - smoothstep(1.0 - edge, 1.0, f));
    prof = mix(prof, ter, u_d.y);
  }
  if (u_d.z > 0.001) {
    float wph = dot(q, vec2(cos(u_d.w), sin(u_d.w))) * u_b.w;
    float s2 = sin(wph);
    float aa2 = min(fwidth(wph), 1.2);
    prof = mix(prof, prof * sqrt(s2 * s2 + 0.0025 + aa2 * aa2 * 0.30) * 1.45, u_d.z);
  }
  ridge = prof;
  float width = mix(r * 3.14159 / u_a.z, 3.14159 / u_b.w, u_b.z);
  float tall = 0.77 + 0.23 * sin(ph * 0.5 + 1.3) * sin(r * 0.9 + 0.4 + t * 0.065);       // crests of uneven height breathing gently
  float h = prof * width * 0.67 * tall * u_amp;
  h += u_b.y * 0.27 * mix(0.45, 1.0, u_amp) * sin(q.x * 0.75 + t * 0.062) * cos(q.y * 0.65 - t * 0.050);
  return h;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y * 2.0;
  float e = 2.0 / u_res.y;
  float r0, r1;
  float h0 = height(p, r0);
  float hx = height(p + vec2(e, 0.0), r1);
  float hy = height(p + vec2(0.0, e), r1);
  vec3 n = normalize(vec3(h0 - hx, h0 - hy, e));

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(
    -0.54 + 0.12 * sin(u_time * 0.20) + u_ptr.x * 0.40,
    0.58 + 0.09 * cos(u_time * 0.16) - u_ptr.y * 0.30,
    0.56
  ));

  // Single fast analytical penumbra tap (half the height() evaluations on mobile GPUs).
  float shade = 1.0;
  if (u_quality > 0.20) {
    vec2 lxy = normalize(L.xy);
    float lSlope = L.z / length(L.xy);
    float rA = 0.064;
    float hsA = height(p + lxy * rA, r1);
    shade = 1.0 - 0.72 * smoothstep(-0.004, 0.038, hsA - h0 - rA * lSlope);
  } else {
    shade = mix(0.58, 1.0, smoothstep(0.08, 0.72, r0));
  }

  float ndl = dot(n, L);
  float dif = smoothstep(-0.20, 1.0, ndl);
  vec3 H1 = normalize(L + V);
  float ndh = max(dot(n, H1), 0.0);
  float satin = pow(ndh, 7.5);
  float spec = pow(ndh, 58.0);
  float knife = pow(ndh, 190.0);
  float fresnel = pow(1.0 - max(n.z, 0.0), 2.8);
  vec3 L2 = normalize(vec3(0.80 + 0.10 * cos(u_time * 0.18), -0.32 + 0.08 * sin(u_time * 0.14), 0.42));
  float rim = pow(max(dot(n, normalize(L2 + V)), 0.0), 11.0);
  float ao = mix(mix(1.0, 0.20, u_amp), 1.0, smoothstep(0.0, 0.62, r0));
  // Subtle brushed titanium sheen grazing the upper architectural crowns.
  float crown = smoothstep(0.45, 0.98, r0) * smoothstep(-0.45, 0.65, p.y);

  vec3 col = mix(u_f.rgb, u_e.rgb, dif * dif * shade) * ao;
  // Cool sculptural fill in the deep valleys so ridges read as solid machined metal.
  col += (u_e.rgb * 0.095 + u_g.rgb * 0.018) * (1.0 - dif) * ao;
  col += satin * 0.24 * mix(vec3(0.66, 0.79, 1.00), u_e.rgb * 3.1, 0.48) * ao * shade;
  col += (spec * 1.12 + knife * 0.55 * crown) * vec3(0.94, 0.975, 1.00) * shade * smoothstep(0.06, 0.34, r0);
  col += (rim * 0.17 + fresnel * (0.075 + 0.05 * crown) * shade) * u_e.w * mix(u_g.rgb, vec3(0.56, 0.74, 1.0), 0.35) * ao;

  // Light gathers around the focus; towards the edges the scene falls cleanly into night.
  float d = length((p - u_c.yz) * vec2(0.80, 0.96));
  col *= mix(1.18, 0.065, smoothstep(0.22, 2.25, d));
  col *= u_c.x;
  col = col / (1.0 + col * 0.48);
  col = pow(col, vec3(0.4545));
  // Film grain only at native resolution; a faint dither always, against banding in the dark.
  col += (hash(gl_FragCoord.xy) - 0.5) * (u_c.w * smoothstep(0.85, 1.0, u_px) + 0.006);
  outColor = vec4(col, 1.0);
}`;

/** Folded presets used by the hero and text-page NightBand, plus fallback
 *  channel records kept for preset-shape callers. Module surfaces themselves
 *  render through the procedural shaders in moduleMaterials.ts. */
export const PRESETS: Record<ReliefName, ReliefPreset> = {
  hero:        { a: [-2.30, -1.70, 24, 1.70],  b: [1.10, 1.30, 0.00, 9.0],  c: [1.25, 0.70, 0.32, 0.030], d: [0, 0, 0, 0],    e: [0.235, 0.262, 0.318, 1.0], f: [0.006, 0.009, 0.017, 0.00],  g: [0.24, 0.40, 0.98, 0] },
  page:        { a: [-2.30, -1.70, 48, 0.60],  b: [0.50, 0.45, 0.00, 9.0],  c: [0.80, 0.70, 0.32, 0.030], d: [0, 0, 0, 0],    e: [0.141, 0.157, 0.191, 0.6], f: [0.006, 0.009, 0.017, 0.00],  g: [0.24, 0.40, 0.98, 0] },
  kerf:    { a: [0.60, -30.0, 250, 0.35],  b: [0.50, 0.90, 0.00, 9.0],  c: [0.95, 0.80, 0.50, 0.024], d: [0, 1, 0, 0],    e: [0.345, 0.300, 0.225, 0.9], f: [0.020, 0.013, 0.007, 0.012], g: [0.98, 0.62, 0.22, 0] },
  taper:   { a: [1.75, 1.05, 30, 0.45],    b: [0.55, 0.80, 1.00, 8.0],  c: [1.00, 0.95, 0.40, 0.024], d: [0, 0, 0, 0],    e: [0.105, 0.270, 0.262, 1.8], f: [0.003, 0.016, 0.019, -0.11], g: [0.20, 0.95, 0.80, 0] },
  chamfer: { a: [-9.0, -38.0, 150, 0.10],  b: [0.16, 0.50, 0.00, 9.0],  c: [0.74, 0.60, 0.30, 0.024], d: [1, 0, 0, 0],    e: [0.400, 0.396, 0.388, 0.5], f: [0.022, 0.022, 0.026, 0.006], g: [0.95, 0.80, 0.55, 0] },
  lathe:         { a: [-26.0, 14.0, 330, 0.15],  b: [0.30, 0.70, 0.00, 11.0], c: [1.00, 0.70, 0.35, 0.024], d: [0, 0, 1, 1.15], e: [0.300, 0.172, 0.262, 1.3], f: [0.017, 0.006, 0.015, 0.030], g: [0.95, 0.35, 0.70, 0] },
};

export interface ReliefHandle {
  /** Flow into another preset over `ms` milliseconds. */
  set(name: ReliefName, ms?: number): void;
  /** Engage or release the rapid-switch Voronoi/Simplex mineral scrub field. */
  setScrub(active: boolean, target: ReliefName, pulse?: number): void;
  destroy(): void;
}

export interface ReliefOptions {
  surface?: ReliefSurface;
}

interface ProgramSlot {
  prog: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const SCRUB_TINTS: Record<ReliefName, readonly [number, number, number]> = {
  hero:        [0.56, 0.71, 1.00],
  page:        [0.56, 0.71, 1.00],
  kerf:    [0.925, 0.773, 0.514], // --m-kerf #ecc583
  taper:   [0.455, 0.867, 0.800], // --m-taper #74ddcc
  chamfer: [0.910, 0.922, 0.941], // --m-chamfer #e8ebf0
  lathe:         [0.929, 0.647, 0.812], // --m-lathe #eda5cf
};

interface Instance {
  canvas: HTMLCanvasElement;
  visible: boolean;
  cur: ReliefPreset;
  from: ReliefPreset | null;
  to: ReliefPreset | null;
  t0: number;
  dur: number;
  /** Height and form of the surface; continuous across switches (see fold.ts). */
  fold: FoldState;
  /** Rapid-switch Voronoi/Simplex lattice scrub state (0 at rest -> 0 idle GPU cost). */
  scrub: number;
  scrubWant: number;
  scrubTint: [number, number, number];
  scrubTintWant: readonly [number, number, number];
  scrubPhase: number;
  scrubPhaseWant: number;
  scrubImpulse: number;
  lastPulse: number;
  lastDraw: number;
  minFrameMs: number;
  mobile: boolean;
  budget: number;
  floor: number;
  quality: number;
  maxQuality: number;
  slow: number;
  fast: number;
  ceiling: number;
  px: number;
  stalled: number;
  skip: boolean;
  tick: number;
  lost: boolean;
  draw(now: number): void;
  resize(): boolean;
}

const FOLD_UNIFORMS = ['u_res', 'u_time', 'u_ptr', 'u_a', 'u_b', 'u_c', 'u_d', 'u_e', 'u_f', 'u_g', 'u_amp', 'u_px', 'u_quality'] as const;
const MATERIAL_UNIFORMS = ['u_res', 'u_time', 'u_ptr', 'u_amp', 'u_px', 'u_band', 'u_quality', 'u_scrub', 'u_scrubTint', 'u_scrubPulse'] as const;

const instances = new Set<Instance>();
const listeners = new Set<() => void>();
let playing = true;
let supported = false;
let still = false;              // true: no live relief on this device, pictures instead
let raf = 0;
let last = 0;
let clock = 40;                 // scene time: stands still while paused; 40 is a good-looking still
let ptrX = 0, ptrY = 0, tgtX = 0, tgtY = 0;
let pointerBound = false;

const reducedNow = () =>
  document.documentElement.classList.contains('reduce-motion') ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function onPointer(e: PointerEvent) {
  tgtX = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
  tgtY = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
}

function frame(now: number) {
  raf = 0;
  const dt = last ? now - last : 16.7;
  last = now;
  if (playing) clock += Math.min(dt, 50) * 0.001;
  ptrX += (tgtX - ptrX) * 0.075;
  ptrY += (tgtY - ptrY) * 0.075;
  let active = false;
  instances.forEach((inst) => {
    if (still || !inst.visible || inst.lost || (!playing && !changing(inst))) return;
    active = true;
    // Cap idle ambient frame rate (30 fps on coarse/mobile 120 Hz displays, 60 fps on desktop)
    // so slow sculptural motion never saturates mobile tile GPUs or high-refresh monitors.
    const elapsed = inst.lastDraw ? now - inst.lastDraw : inst.minFrameMs;
    if (elapsed < inst.minFrameMs && !changing(inst)) return;
    inst.tick++;
    if (inst.skip && inst.tick % 2) return;
    const drawStart = performance.now();
    inst.draw(now);
    const drawMs = performance.now() - drawStart;
    if (!playing || dt > 250) return;            // a waking tab does not count as a slow frame
    const slowFrame = dt > (inst.mobile ? 52 : 28) || drawMs > (inst.mobile ? 12 : 14);
    inst.slow = slowFrame ? inst.slow + 1 : Math.max(0, inst.slow - 1);
    // Room to spare: first sharpen resolution within budget, then step quality up to maxQuality.
    inst.fast = !slowFrame && dt < (inst.mobile ? 22 : 18.5) ? inst.fast + 1 : 0;
    if (inst.fast > 90) {
      inst.fast = 0;
      if (inst.px < 1 && inst.budget < inst.ceiling) {
        inst.budget = Math.min(inst.ceiling, inst.budget * 1.25);
        if (inst.resize()) inst.draw(now);
      } else if (inst.quality < inst.maxQuality) {
        inst.quality = Math.min(inst.maxQuality, +(inst.quality + 0.25).toFixed(2));
        inst.draw(now);
      }
    }
    if (inst.slow > 8) {
      inst.slow = 0;
      // Step down shader quality, then resolution, then frame rate; fall back cleanly to .webp stills if still slow.
      if (inst.quality > 0.05) {
        inst.quality = Math.max(0, +(inst.quality - 0.35).toFixed(2));
        inst.maxQuality = Math.min(inst.maxQuality, inst.quality);
        inst.draw(now);
      } else if (inst.budget > inst.floor) {
        inst.ceiling = Math.min(inst.ceiling, inst.budget * 0.76);
        inst.budget = Math.max(inst.floor, inst.budget * 0.76);
        if (inst.resize()) inst.draw(now);
      } else if (!inst.skip) {
        inst.skip = true;
      } else if (++inst.stalled > 2) {
        still = true;
        emit();
      }
    }
  });
  if (active && !document.hidden) raf = requestAnimationFrame(frame);
  else last = 0;
}

function kick() {
  if (!raf && typeof document !== 'undefined' && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); }
}

const emit = () => listeners.forEach((fn) => fn());

/** Store for the pause/resume control (see useSyncExternalStore in Relief.tsx). */
export const reliefStore = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  playing: () => playing,
  supported: () => supported,
  still: () => still,
};

export function setReliefPlaying(next: boolean) {
  if (playing === next) return;
  playing = next;
  emit();
  kick();
}

/** Devices on which the live relief is not even attempted. */
function tooWeak(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency || 8) <= 2 || (nav.deviceMemory || 8) <= 2 || nav.connection?.saveData === true;
}

/** Without a live relief the pictures take over (see .still in home.module.css). */
export function reliefUnavailable() {
  if (still) return;
  still = true;
  emit();
}

/** Whether an instance is in the middle of a change (colours, folds, or Voronoi scrub). */
const changing = (inst: Instance) =>
  !!inst.to || inst.fold.form !== inst.fold.want || inst.fold.p < 1 ||
  inst.scrub > 0.001 || inst.scrubWant > 0.001 || inst.scrubImpulse > 0.001;

export function createRelief(canvas: HTMLCanvasElement, name: ReliefName, opts: ReliefOptions = {}): ReliefHandle | null {
  if (still || tooWeak()) return null;
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;

  const bandValue = opts.surface === 'band' ? 1.0 : 0.0;
  const programs = new Map<string, ProgramSlot>();
  let vao: WebGLVertexArrayObject | null = null;
  let activeProg: WebGLProgram | null = null;

  const compileProgram = (fsSource: string, keys: readonly string[]): ProgramSlot => {
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        throw new Error('shader');
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      throw new Error('link');
    }
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const k of keys) uniforms[k] = gl.getUniformLocation(prog, k);
    return { prog, uniforms };
  };

  const ensureSlot = (key: ReliefName): ProgramSlot | null => {
    const slotKey = isModuleMaterial(key) ? key : 'fold';
    const existing = programs.get(slotKey);
    if (existing) return existing;
    try {
      const slot = isModuleMaterial(key)
        ? compileProgram(moduleFragmentShader(key), MATERIAL_UNIFORMS)
        : compileProgram(FS, FOLD_UNIFORMS);
      programs.set(slotKey, slot);
      return slot;
    } catch {
      return null;
    }
  };

  const initContext = (initial: ReliefName) => {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    activeProg = null;
    return ensureSlot(initial) !== null;
  };

  if (!initContext(name)) return null;

  const mobile = window.matchMedia('(pointer: coarse)').matches ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
  const weak = (navigator.hardwareConcurrency || 8) <= 4 ||
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8) <= 4;
  let software = false;
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const rdr = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
      software = /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(rdr);
    }
  } catch {
    /* keep hardware default */
  }
  const initialQuality = software ? 0.25 : mobile ? 0.35 : weak ? 0.50 : 1.0;

  // Pre-compile remaining module shaders during browser idle slices on desktop
  // (on mobile, compile lazily on demand so initial hero scroll stays 120 Hz smooth).
  const prewarmTimers: number[] = [];
  const cancelPrewarm: (() => void)[] = [];
  if (!mobile && isModuleMaterial(name) && bandValue === 0) {
    const rest = (['taper', 'chamfer', 'lathe', 'kerf'] as const).filter((id) => id !== name);
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    });
    const scheduleOne = (idx: number) => {
      if (idx >= rest.length || inst.lost) return;
      const run = () => {
        if (inst.lost) return;
        if (changing(inst)) {
          const retry = window.setTimeout(() => scheduleOne(idx), 250);
          prewarmTimers.push(retry);
          return;
        }
        ensureSlot(rest[idx]);
        const nextTid = window.setTimeout(() => scheduleOne(idx + 1), 160);
        prewarmTimers.push(nextTid);
      };
      if (ric.requestIdleCallback) {
        const handle = ric.requestIdleCallback(run, { timeout: 1400 });
        cancelPrewarm.push(() => ric.cancelIdleCallback?.(handle));
      } else {
        const tid = window.setTimeout(run, 480);
        prewarmTimers.push(tid);
      }
    };
    const startTid = window.setTimeout(() => scheduleOne(0), 650);
    prewarmTimers.push(startTid);
  }

  const initTint = SCRUB_TINTS[name] ?? SCRUB_TINTS.kerf;
  const inst: Instance = {
    canvas,
    visible: true,
    cur: lerpPreset(PRESETS[name], PRESETS[name], 1),
    from: null, to: null, t0: 0, dur: 1500,
    fold: { p: 1, form: name, want: name },
    scrub: 0,
    scrubWant: 0,
    scrubTint: [initTint[0], initTint[1], initTint[2]],
    scrubTintWant: initTint,
    scrubPhase: 0,
    scrubPhaseWant: 0,
    scrubImpulse: 0,
    lastPulse: 0,
    lastDraw: 0,
    minFrameMs: software || mobile ? 32 : 15,
    mobile,
    budget: software ? 190000 : mobile ? 260000 : weak ? 850000 : 1500000,
    floor: software ? 130000 : mobile ? 150000 : weak ? 360000 : 420000,
    quality: initialQuality,
    maxQuality: initialQuality,
    slow: 0, fast: 0,
    ceiling: software ? 360000 : mobile ? 440000 : weak ? 1600000 : 2800000,
    px: 1, stalled: 0, skip: false, tick: 0, lost: false,
    resize() {
      const r = canvas.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      const dpr = window.devicePixelRatio || 1;
      const [w, h] = renderSize(r.width, r.height, dpr, inst.budget);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      inst.px = Math.min(1, w / (r.width * Math.min(dpr, 2)));
      return true;
    },
    draw(now) {
      if (inst.lost) return;
      const dt = inst.lastDraw ? Math.min(100, now - inst.lastDraw) : 0;
      inst.lastDraw = now;
      if (inst.scrubWant > inst.scrub) {
        inst.scrub = Math.min(inst.scrubWant, inst.scrub + dt / 115);
      } else if (inst.scrubWant < inst.scrub) {
        inst.scrub = Math.max(inst.scrubWant, inst.scrub - dt / 360);
      }
      if (inst.scrub > 0.001 || inst.scrubWant > 0.001) {
        const kTint = 1 - Math.exp(-dt * 0.015);
        inst.scrubTint[0] += (inst.scrubTintWant[0] - inst.scrubTint[0]) * kTint;
        inst.scrubTint[1] += (inst.scrubTintWant[1] - inst.scrubTint[1]) * kTint;
        inst.scrubTint[2] += (inst.scrubTintWant[2] - inst.scrubTint[2]) * kTint;
        inst.scrubPhase += (inst.scrubPhaseWant - inst.scrubPhase) * (1 - Math.exp(-dt * 0.012));
        inst.scrubImpulse = Math.max(0, inst.scrubImpulse - dt / 340);
        // Once the Voronoi veil covers the stage, swap the underlying material silently
        // at full amplitude so dissolving out reveals the chosen module cleanly.
        if (inst.scrub >= 0.78 && inst.fold.form !== inst.fold.want) {
          inst.fold = { p: 1, form: inst.fold.want, want: inst.fold.want };
        }
      } else {
        inst.scrubImpulse = 0;
      }
      if (changing(inst) && inst.scrub < 0.78) inst.fold = stepFold(inst.fold, dt, inst.dur / 2);
      const amp = foldHeight(inst.fold.p);
      const activeName = inst.fold.form as ReliefName;
      const slot = ensureSlot(activeName);
      if (!slot) {
        inst.lost = true;
        delete canvas.dataset.on;
        return;
      }
      if (activeProg !== slot.prog) {
        gl.useProgram(slot.prog);
        activeProg = slot.prog;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);

      const u = slot.uniforms;
      if (isModuleMaterial(activeName)) {
        gl.uniform2f(u.u_res, canvas.width, canvas.height);
        gl.uniform1f(u.u_time, clock);
        gl.uniform2f(u.u_ptr, ptrX, ptrY);
        gl.uniform1f(u.u_amp, amp);
        gl.uniform1f(u.u_px, inst.px);
        gl.uniform1f(u.u_band, bandValue);
        if (u.u_quality) gl.uniform1f(u.u_quality, inst.quality);
        if (u.u_scrub) gl.uniform1f(u.u_scrub, inst.scrub);
        if (u.u_scrubTint) gl.uniform3f(u.u_scrubTint, inst.scrubTint[0], inst.scrubTint[1], inst.scrubTint[2]);
        if (u.u_scrubPulse) gl.uniform2f(u.u_scrubPulse, inst.scrubPhase, inst.scrubImpulse);
      } else {
        let colour = inst.cur;
        if (inst.to && inst.from) {
          const k = Math.min(1, (now - inst.t0) / inst.dur);
          colour = lerpPreset(inst.from, inst.to, k * k * (3 - 2 * k));
          if (k >= 1) { inst.to = null; inst.from = null; }
        }
        const form = PRESETS[activeName];
        inst.cur = { ...colour, a: form.a, b: form.b, d: form.d, f: [colour.f[0], colour.f[1], colour.f[2], form.f[3]] };
        gl.uniform2f(u.u_res, canvas.width, canvas.height);
        gl.uniform1f(u.u_time, clock);
        gl.uniform2f(u.u_ptr, ptrX, ptrY);
        gl.uniform4fv(u.u_a, inst.cur.a);
        gl.uniform4fv(u.u_b, inst.cur.b);
        gl.uniform4fv(u.u_c, inst.cur.c);
        gl.uniform4fv(u.u_d, inst.cur.d);
        gl.uniform4fv(u.u_e, inst.cur.e);
        gl.uniform4fv(u.u_f, inst.cur.f);
        gl.uniform4fv(u.u_g, inst.cur.g);
        gl.uniform1f(u.u_amp, amp);
        gl.uniform1f(u.u_px, inst.px);
        if (u.u_quality) gl.uniform1f(u.u_quality, inst.quality);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.dataset.on = 'true';
    },
  };

  const sync = () => { supported = Array.from(instances).some((i) => !i.lost); emit(); };
  const onLost = (e: Event) => { e.preventDefault(); inst.lost = true; delete canvas.dataset.on; sync(); };   // back to the CSS picture
  const onRestored = () => {
    programs.clear();
    activeProg = null;
    if (initContext(inst.fold.form as ReliefName)) {
      inst.lost = false;
      inst.draw(performance.now());
      kick();
    } else {
      inst.lost = true;
    }
    sync();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  const io = new IntersectionObserver((entries) => { inst.visible = entries[0].isIntersecting; kick(); });
  io.observe(canvas);
  const ro = new ResizeObserver(() => { if (inst.resize()) inst.draw(performance.now()); });
  ro.observe(canvas);

  if (!instances.size) {
    playing = !reducedNow();
    document.addEventListener('visibilitychange', kick);
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      pointerBound = true;
    }
  }
  instances.add(inst);
  sync();
  inst.resize();
  inst.draw(performance.now());
  kick();

  return {
    set(next, ms = 1500) {
      const target = PRESETS[next];
      if (reducedNow() || ms <= 0) {
        inst.cur = lerpPreset(target, target, 1); inst.to = null; inst.from = null;
        inst.fold = { p: 1, form: next, want: next };
        inst.draw(performance.now());
        return;
      }
      if (isModuleMaterial(next)) {
        // Warm the target shader before p reaches zero so the switch itself never drops a frame.
        ensureSlot(next);
        inst.from = null;
        inst.to = null;
      } else {
        inst.from = inst.cur;
        inst.to = target;
      }
      inst.t0 = performance.now();
      inst.dur = ms;
      inst.fold = { ...inst.fold, want: next };
      kick();
    },
    setScrub(active, target, pulse = 0) {
      if (reducedNow()) {
        inst.scrub = 0;
        inst.scrubWant = 0;
        inst.scrubImpulse = 0;
        return;
      }
      inst.scrubTintWant = SCRUB_TINTS[target] ?? SCRUB_TINTS.kerf;
      if (active) {
        if (isModuleMaterial(target)) ensureSlot(target);
        inst.fold = { ...inst.fold, want: target };
        inst.scrubWant = 1;
        if (pulse !== inst.lastPulse) {
          inst.lastPulse = pulse;
          inst.scrubPhaseWant += 0.68;
          inst.scrubImpulse = 1.0;
        }
      } else {
        // Releasing after rapid clicks: ensure the settled target module is
        // already mounted underneath before the Voronoi veil dissolves out.
        if (inst.scrub > 0.35 && inst.fold.form !== target) {
          if (isModuleMaterial(target)) ensureSlot(target);
          inst.fold = { p: 1, form: target, want: target };
        }
        inst.scrubWant = 0;
      }
      kick();
    },
    destroy() {
      prewarmTimers.forEach((id) => window.clearTimeout(id));
      cancelPrewarm.forEach((fn) => fn());
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      instances.delete(inst);
      programs.forEach(({ prog }) => gl.deleteProgram(prog));
      programs.clear();
      if (vao) gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();   // free the GPU context now, not at GC
      if (!instances.size) {
        document.removeEventListener('visibilitychange', kick);
        if (pointerBound) { window.removeEventListener('pointermove', onPointer); pointerBound = false; }
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        supported = false;
        emit();
      }
    },
  };
}
