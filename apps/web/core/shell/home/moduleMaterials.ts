/**
 * Procedural WebGL2 fragment shaders for the four Deutschland Together modules.
 * Each surface synthesizes its geometry, studio lighting, grain and quiet
 * continuous motion purely mathematically (no external images or samplers).
 *
 * Shared uniforms:
 *  - u_res     : backing-store canvas size in pixels
 *  - u_time    : scene clock in seconds (stands still when paused / reduced motion)
 *  - u_ptr     : smoothed pointer offset in [-1, 1]
 *  - u_amp     : fold/reveal amplitude in [0, 1] (dips to 0 at --night on switch)
 *  - u_px      : rendered pixels per native device pixel (fades sub-pixel noise down)
 *  - u_band    : 0 on the homepage module stage, 1 in a wide NightBand header
 *  - u_quality : 0..1 adaptive 3D detail budget (full parallax raymarch vs light crisp 3D)
 */

export type ModuleMaterialId = 'kerf' | 'taper' | 'chamfer' | 'lathe';

export const MODULE_MATERIALS: readonly ModuleMaterialId[] = [
  'kerf',
  'taper',
  'chamfer',
  'lathe',
] as const;

export function isModuleMaterial(name: string): name is ModuleMaterialId {
  return name === 'kerf' || name === 'taper' || name === 'chamfer' || name === 'lathe';
}

const PREAMBLE = `#version 300 es
precision highp float;
precision mediump int;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_ptr;
uniform float u_amp;
uniform float u_px;
uniform float u_band;
uniform float u_quality;
uniform float u_scrub;
uniform vec3 u_scrubTint;
uniform vec2 u_scrubPulse;
out vec4 fragColor;

const vec3 NIGHT = vec3(0.02353, 0.03137, 0.05098);

// Fast float-ALU hash (4-6x faster than 32-bit uint multiply/XOR on mobile PowerVR/Mali/Adreno GPUs).
float hash21f(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22f(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Lightweight 2D Simplex noise for kinetic rapid-switch Voronoi domain warping.
float scrubSimplex(vec2 p) {
  const float F = 0.3660254038, G = 0.2113248654;
  vec2 i = floor(p + (p.x + p.y) * F);
  vec2 a = p - i + (i.x + i.y) * G;
  vec2 j = a.x > a.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - j + G, c = a - 1.0 + 2.0 * G;
  vec3 t = max(vec3(0.5) - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  t *= t; t *= t;
  vec2 ga = normalize(hash22f(i) - 0.5 + 1e-4);
  vec2 gb = normalize(hash22f(i + j) - 0.5 + 1e-4);
  vec2 gc = normalize(hash22f(i + vec2(1.0)) - 0.5 + 1e-4);
  return clamp(0.5 + 32.0 * dot(t, vec3(dot(ga, a), dot(gb, b), dot(gc, c))), 0.0, 1.0);
}

// Sculpted obsidian Voronoi + Simplex mineral fracture field shown ONLY while
// the user scrubs rapidly across module tabs (zero GPU cost when u_scrub == 0).
vec3 scrubLattice(vec2 frag) {
  float minDim = max(min(u_res.x, u_res.y), 1.0);
  vec2 uv = (frag - 0.5 * u_res) / minDim;
  float t = u_time;
  float phase = u_scrubPulse.x;
  float pulse = clamp(u_scrubPulse.y, 0.0, 1.0);

  // Subtle dual-octave Simplex tectonic tension (~0.2 cell units): keeps Voronoi
  // shards crisp and architectural like fractured obsidian while flowing on clicks.
  vec2 sBase = uv * 2.1 + vec2(t * 0.22 + phase * 0.36, -t * 0.16 - phase * 0.22);
  float s1 = scrubSimplex(sBase);
  float s2 = scrubSimplex(sBase * 2.0 + vec2(4.7, -3.1));
  vec2 warp = (vec2(s1, s2) - 0.5) * (0.044 + 0.024 * pulse);
  vec2 g = (uv + warp) * 4.6;
  vec2 ig = floor(g), fg = fract(g);

  float f1 = 8.0, f2 = 8.0;
  vec2 bestOff = vec2(0.0);
  vec2 bestId = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 n = vec2(float(x), float(y));
      vec2 id = ig + n;
      vec2 rnd = hash22f(id);
      vec2 pt = n + 0.5 + 0.37 * sin(t * 0.65 + phase * 1.45 + 6.28318 * rnd) - fg;
      float d = dot(pt, pt);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        bestOff = pt;
        bestId = id;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  f1 = sqrt(f1);
  f2 = sqrt(f2);
  float edge = max(0.0, f2 - f1);

  // Architectural beveled slate facets with crisp planar tilt and studio key light.
  vec2 facetTilt = (hash22f(bestId + 19.3) - 0.5) * 0.82 + (vec2(s1, s2) - 0.5) * 0.14;
  vec3 N = normalize(vec3(facetTilt - bestOff * 0.14, 1.0));
  vec3 L = normalize(vec3(
    -0.54 + 0.18 * sin(t * 0.52 + phase * 0.85) + u_ptr.x * 0.36,
    0.58 + 0.14 * cos(t * 0.40 - phase * 0.65) - u_ptr.y * 0.28,
    0.62
  ));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = smoothstep(-0.12, 1.0, dot(N, L));
  float spec = pow(max(dot(N, H), 0.0), 36.0);
  float cellTone = 0.60 + 0.40 * hash21f(bestId + 7.1);

  vec3 stone = mix(NIGHT, vec3(0.095, 0.112, 0.148), diff * cellTone);
  stone += vec3(0.18, 0.21, 0.26) * spec * cellTone;
  // Crisp dark chamfer groove framing every polygonal obsidian shard.
  stone *= 1.0 - 0.64 * exp(-edge * 22.0);

  // Smooth pinhole-free mineral fracture inlay (no fwidth cusp breaks on Voronoi ridges).
  float seam = 1.0 - smoothstep(0.005, 0.032, edge);
  float bevelGlow = exp(-edge * 16.0);
  float rippleDist = length(uv) - (1.0 - pulse) * 0.95;
  float wave = exp(-rippleDist * rippleDist * 14.0) * pulse;
  float lumGate = smoothstep(0.32, 0.86, s1 * 0.60 + s2 * 0.40 + wave * 0.55);

  vec3 tint = mix(vec3(0.76, 0.83, 0.94), u_scrubTint, 0.88);
  vec3 col = stone;
  col += tint * bevelGlow * (0.08 + 0.15 * lumGate + 0.18 * wave);
  col += mix(tint, vec3(1.0), 0.38) * seam * (0.16 + 0.56 * lumGate + 0.42 * wave);

  // Vignette cleanly into NIGHT so the target readout stays high-contrast.
  float rad = length(uv * vec2(0.84, 1.02));
  col = mix(col, NIGHT, smoothstep(0.32, 1.22, rad) * 0.68);
  col += (hash21f(frag + fract(t) * 13.0) - 0.5) * 0.008;
  return clamp(col, 0.0, 1.0);
}

// Aspect-preserving cover mapping centered on focus; wide NightBand strips
// broaden scale gently so diagonal edges stay in frame without stretching.
vec2 materialUV(vec2 frag, vec2 res, vec2 focus, float band) {
  float aspect = res.x / max(res.y, 1.0);
  float s = mix(max(res.x, res.y), res.x * 0.68, band * clamp((aspect - 1.6) / 2.4, 0.0, 1.0));
  return (vec2(frag.x, res.y - frag.y) - 0.5 * res) / s + focus;
}

vec3 finishColor(vec3 col, float amp, float band) {
  float k = clamp(amp, 0.0, 1.0);
  // Calm exposure slightly inside a wide page header band behind module titles.
  col *= mix(1.0, 0.78, band);
  // Highlights recede first as the surface dips down into night.
  vec3 dimmed = mix(col * (0.28 + 0.72 * k), pow(max(col, 0.0), vec3(1.18)) * k, 1.0 - k);
  vec3 base = clamp(mix(NIGHT, dimmed, k), 0.0, 1.0);
  if (u_scrub > 0.001) {
    float s = clamp(u_scrub, 0.0, 1.0);
    s = s * s * (3.0 - 2.0 * s);
    base = mix(base, scrubLattice(gl_FragCoord.xy), s);
  }
  return base;
}
`;

const KERF_FS = `${PREAMBLE}
float hash21(vec2 p) { return hash21f(floor(p) + vec2(17.3, 41.7)); }
vec2 hash22(vec2 p) { return hash22f(floor(p) + vec2(17.3, 41.7)); }
// Value noise with analytical spatial gradient for crisp 2.5D slate normals.
vec3 nd(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 dw = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hash21f(i), b = hash21f(i + vec2(1.0, 0.0));
  float c = hash21f(i + vec2(0.0, 1.0)), d = hash21f(i + vec2(1.0, 1.0));
  return vec3(
    mix(mix(a, b, w.x), mix(c, d, w.x), w.y),
    dw.x * mix(b - a, d - c, w.y),
    dw.y * mix(c - a, d - b, w.x)
  );
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21f(i), hash21f(i + vec2(1.0, 0.0)), w.x),
    mix(hash21f(i + vec2(0.0, 1.0)), hash21f(i + vec2(1.0, 1.0)), w.x),
    w.y
  );
}
float f3(vec2 p) {
  return noise(p) * 0.57 + noise(p * 2.07 + 31.4) * 0.28 + noise(p * 4.19 - 17.2) * 0.15;
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.52;
  s += a * noise(p); p = mat2(1.93, 0.31, -0.31, 1.93) * p + vec2(7.2, 13.8); a *= 0.5;
  s += a * noise(p); p = mat2(1.93, 0.31, -0.31, 1.93) * p + vec2(7.2, 13.8); a *= 0.5;
  s += a * noise(p);
  if (u_quality > 0.60) {
    p = mat2(1.93, 0.31, -0.31, 1.93) * p + vec2(7.2, 13.8);
    s += a * 0.5 * noise(p);
    return s / 0.975;
  }
  return s / 0.91;
}
mat2 rotate(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 q = p - a, v = b - a;
  return length(q - v * clamp(dot(q, v) / dot(v, v), 0.0, 1.0));
}
float tapered(vec2 p, vec3 a, vec3 b) {
  vec2 v = b.xy - a.xy;
  float t = clamp(dot(p - a.xy, v) / dot(v, v), 0.0, 1.0);
  return length(p - a.xy - v * t) / mix(a.z, b.z, t);
}

const int NT = 37;
const vec2 TOP[NT] = vec2[NT](
  vec2(.230,.203),vec2(.235,.125),vec2(.263,.103),vec2(.310,.113),
  vec2(.350,.101),vec2(.358,.080),vec2(.404,.079),vec2(.410,.065),
  vec2(.460,.067),vec2(.519,.081),vec2(.561,.098),vec2(.580,.064),
  vec2(.568,.040),vec2(.604,.038),vec2(.610,.028),vec2(.651,.033),
  vec2(.717,.050),vec2(.766,.087),vec2(.805,.127),vec2(.827,.178),
  vec2(.844,.252),vec2(.813,.269),vec2(.780,.277),vec2(.770,.320),
  vec2(.716,.348),vec2(.689,.383),vec2(.646,.378),vec2(.623,.331),
  vec2(.550,.318),vec2(.475,.312),vec2(.458,.359),vec2(.417,.334),
  vec2(.374,.324),vec2(.340,.318),vec2(.314,.293),vec2(.283,.251),
  vec2(.255,.230)
);
float topSDF(vec2 p) {
  if (p.x < 0.21 || p.x > 0.87 || p.y < 0.01 || p.y > 0.41) return 0.25;
  float d = dot(p - TOP[0], p - TOP[0]), sgn = 1.0;
  for (int i = 0, j = NT - 1; i < NT; j = i, i++) {
    vec2 e = TOP[j] - TOP[i], w = p - TOP[i];
    vec2 q = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(q, q));
    bvec3 b = bvec3(p.y >= TOP[i].y, p.y < TOP[j].y, e.x * w.y > e.y * w.x);
    if (all(b) || all(not(b))) sgn = -sgn;
  }
  return sqrt(d) * sgn;
}

const int NF = 12;
const vec2 FACE[NF] = vec2[NF](
  vec2(-.09,.200),vec2(.129,.272),vec2(.304,.348),vec2(.457,.401),
  vec2(.572,.502),vec2(.610,.628),vec2(.515,.727),vec2(.390,.797),
  vec2(.270,.783),vec2(.163,.666),vec2(.072,.454),vec2(-.05,.35)
);
float faceSDF(vec2 p) {
  if (p.x < -0.12 || p.x > 0.64 || p.y < 0.17 || p.y > 0.82) return 0.25;
  float d = 10.0, sgn = 1.0;
  for (int i = 0, j = NF - 1; i < NF; j = i, i++) {
    vec2 e = FACE[j] - FACE[i], w = p - FACE[i];
    vec2 q = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(q, q));
    bvec3 b = bvec3(p.y >= FACE[i].y, p.y < FACE[j].y, e.x * w.y > e.y * w.x);
    if (all(b) || all(not(b))) sgn = -sgn;
  }
  return sqrt(d) * sgn;
}

float ridgeY(float x) {
  if (x < .04) return .148;
  if (x < .11) return mix(.148, .173, (x - .04) / .07);
  if (x < .15) return mix(.173, .203, (x - .11) / .04);
  if (x < .18) return mix(.203, .250, (x - .15) / .03);
  if (x < .30) return mix(.250, .311, (x - .18) / .12);
  if (x < .33) return mix(.311, .343, (x - .30) / .03);
  if (x < .37) return mix(.343, .334, (x - .33) / .04);
  if (x < .42) return mix(.334, .353, (x - .37) / .05);
  if (x < .48) return mix(.353, .302, (x - .42) / .06);
  if (x < .60) return mix(.302, .315, (x - .48) / .12);
  if (x < .67) return mix(.315, .340, (x - .60) / .07);
  if (x < .71) return mix(.340, .404, (x - .67) / .04);
  if (x < .79) return mix(.404, .446, (x - .71) / .08);
  if (x < .88) return mix(.446, .421, (x - .79) / .09);
  if (x < .93) return mix(.421, .386, (x - .88) / .05);
  return mix(.386, .368, clamp((x - .93) / .07, 0.0, 1.0));
}

// Voronoi edge distance for fractured mineral veins and dark slate shards.
vec2 cell(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 10.0, d2 = 10.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + hash22(i + g) - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec2(sqrt(d1), sqrt(d2) - sqrt(d1));
}

const int NG = 28;
const vec3 GOLD[NG] = vec3[NG](
  vec3(.677,.220,.0012),vec3(.692,.264,.0018),vec3(.700,.305,.0025),
  vec3(.696,.342,.0050),vec3(.713,.349,.0090),vec3(.691,.374,.0140),
  vec3(.704,.414,.0130),vec3(.714,.454,.0100),vec3(.724,.496,.0080),
  vec3(.733,.536,.0070),vec3(.720,.562,.0065),vec3(.698,.590,.0050),
  vec3(.701,.625,.0065),vec3(.675,.638,.0045),vec3(.623,.638,.0038),
  vec3(.583,.650,.0055),vec3(.550,.678,.0100),vec3(.538,.713,.0120),
  vec3(.541,.758,.0100),vec3(.536,.799,.0160),vec3(.505,.829,.0250),
  vec3(.477,.832,.0200),vec3(.445,.804,.0180),vec3(.411,.784,.0110),
  vec3(.380,.789,.0160),vec3(.355,.810,.0130),vec3(.327,.816,.0080),
  vec3(.291,.806,.0090)
);
const int NB = 17;
const vec3 BOTTOM[NB] = vec3[NB](
  vec3(.002,.569,.0012),vec3(.065,.606,.0022),vec3(.111,.682,.0025),
  vec3(.153,.722,.0038),vec3(.186,.752,.0070),vec3(.218,.767,.0110),
  vec3(.257,.781,.0120),vec3(.290,.806,.0160),vec3(.349,.820,.0100),
  vec3(.408,.840,.0140),vec3(.461,.860,.0110),vec3(.519,.867,.0140),
  vec3(.598,.882,.0180),vec3(.670,.893,.0190),vec3(.718,.933,.0140),
  vec3(.770,.954,.0090),vec3(.822,1.012,.0050)
);

float mineralBand(vec2 p) {
  vec2 q = p + (vec2(f3(p * 62.0 + 9.0), f3(p * 59.0 - 19.0)) - 0.5) * 0.015;
  float d = 100.0;
  if (q.x > 0.24 && q.x < 0.78 && q.y > 0.17 && q.y < 0.88) {
    for (int i = 0; i < NG - 1; i++) d = min(d, tapered(q, GOLD[i], GOLD[i + 1]));
  }
  if (q.x > -0.05 && q.x < 0.88 && q.y > 0.52 && q.y < 1.05) {
    for (int i = 0; i < NB - 1; i++) d = min(d, tapered(q, BOTTOM[i], BOTTOM[i + 1]));
  }
  if (q.x > 0.20 && q.x < 0.52 && q.y > 0.17 && q.y < 0.34) {
    d = min(d, tapered(q, vec3(.233,.202,.0055), vec3(.261,.226,.0035)));
    d = min(d, tapered(q, vec3(.261,.226,.0035), vec3(.284,.249,.0065)));
    d = min(d, tapered(q, vec3(.284,.249,.0065), vec3(.316,.292,.0035)));
    d = min(d, tapered(q, vec3(.395,.269,.0012), vec3(.454,.279,.0024)));
    d = min(d, tapered(q, vec3(.454,.279,.0024), vec3(.486,.285,.0015)));
  }
  if (q.x > 0.74 && q.x < 0.96 && q.y > 0.24 && q.y < 0.43) {
    d = min(d, tapered(q, vec3(.780,.273,.0080), vec3(.767,.302,.0035)));
    d = min(d, tapered(q, vec3(.900,.398,.0015), vec3(.930,.384,.0035)));
  }
  return d / (0.75 + 0.75 * f3(p * 53.0));
}

float fineVeins(vec2 p) {
  if (p.x < 0.08 || p.x > 0.96 || p.y < 0.40 || p.y > 0.97) return 0.0;
  vec2 q = p + (vec2(f3(p * 100.0), f3(p * 93.0 + 8.0)) - 0.5) * 0.006;
  float d = 5.0;
  d = min(d, segment(q, vec2(.706,.456), vec2(.650,.421)));
  d = min(d, segment(q, vec2(.650,.421), vec2(.598,.467)));
  d = min(d, segment(q, vec2(.598,.467), vec2(.581,.519)));
  d = min(d, segment(q, vec2(.598,.467), vec2(.560,.447)));
  d = min(d, segment(q, vec2(.702,.570), vec2(.653,.543)));
  d = min(d, segment(q, vec2(.653,.543), vec2(.667,.584)));
  d = min(d, segment(q, vec2(.551,.695), vec2(.487,.729)));
  d = min(d, segment(q, vec2(.487,.729), vec2(.461,.754)));
  d = min(d, segment(q, vec2(.487,.729), vec2(.518,.764)));
  d = min(d, segment(q, vec2(.541,.755), vec2(.581,.805)));
  d = min(d, segment(q, vec2(.733,.692), vec2(.787,.721)));
  d = min(d, segment(q, vec2(.787,.721), vec2(.855,.772)));
  d = min(d, segment(q, vec2(.858,.843), vec2(.908,.891)));
  d = min(d, segment(q, vec2(.908,.891), vec2(.934,.953)));
  d = min(d, segment(q, vec2(.163,.667), vec2(.108,.591)));
  return (1.0 - smoothstep(.0003, .0016, d)) * smoothstep(.26, .68, fbm(p * 68.0));
}

// Normal-mapped cleaved slate planes (gives crisp 3D strata instead of flat noise).
vec3 slateRock(vec2 p, float angle, float bright, float salt, vec3 L, float fineFade) {
  vec2 sq = rotate(angle) * p + salt;
  if (abs(salt - 17.0) < 0.1) { vec2 d = p - vec2(.695, .397); sq = vec2(length(d), atan(d.y, d.x) * 0.22) + salt; }
  if (abs(salt - 23.0) < 0.1) { vec2 d = p - vec2(.578, .640); sq = vec2(length(d), atan(d.y, d.x) * 0.15) + salt; }
  if (abs(salt - 31.0) < 0.1) { vec2 d = p - vec2(-.28, .84);  sq = vec2(length(d), atan(d.y, d.x) * 0.33) + salt; }

  mat2 R = rotate(angle);
  vec2 warp = vec2(f3(p * 7.5 + salt), f3(p * 8.5 + salt + 19.0)) - 0.5;
  vec2 q = sq + warp * vec2(0.025, 0.045);

  // Layered directional cleavage steps + fine foliation normals.
  vec3 gBroad = nd(q * vec2(4.2, 22.0));
  vec3 gStep  = nd(q * vec2(11.0, 68.0));
  vec3 gFine  = nd(q * vec2(28.0, 190.0));
  vec3 gMicro = fineFade > 0.40 ? nd(q * vec2(58.0, 420.0)) : vec3(0.5, 0.0, 0.0);

  // Ridge sharpen: convert smooth slope to crisp terraced slate ledges.
  float terrace = abs(gStep.x - 0.5);
  float sgnStep = sign(gStep.x - 0.5);
  vec2 grad = transpose(R) * (
    gBroad.yz * vec2(0.35, 1.35) +
    gStep.yz * sgnStep * vec2(0.45, 2.20) +
    gFine.yz * vec2(0.25, 1.15) * (0.4 + 0.6 * fineFade) +
    gMicro.yz * vec2(0.15, 0.65) * fineFade
  );

  vec3 N = normalize(vec3(-grad.x * 0.55, -grad.y * 0.55, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);

  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 18.0);
  float strata = smoothstep(0.08, 0.45, terrace);
  float cloud = 0.55 + 0.70 * f3(p * 12.0 + salt);

  // Crisp cleavage strata normals, studio specular, and hairline bevels.
  float lum = (0.014 + diff * 0.064 * strata + spec * 0.165) * bright * cloud;
  float ridgeLine = pow(1.0 - clamp(terrace * 2.4, 0.0, 1.0), 5.0);
  lum += ridgeLine * (0.020 + 0.048 * diff) * bright * fineFade;
  return vec3(lum) * vec3(0.98, 0.99, 1.015);
}

void main() {
  if (u_scrub > 0.995) { fragColor = vec4(scrubLattice(gl_FragCoord.xy), 1.0); return; }
  vec2 p = materialUV(gl_FragCoord.xy, u_res, vec2(0.50, 0.49), u_band);
  float aa = 1.1 / max(min(u_res.x, u_res.y), 1.0);
  float fineFade = smoothstep(0.25, 0.95, u_px) * mix(0.55, 1.0, clamp(u_quality, 0.0, 1.0));
  float t = u_time;

  float grain = (hash21(gl_FragCoord.xy + 17.0) - 0.5) * 0.011 * fineFade;
  float bg = 0.215 - 0.028 * p.y + 0.016 * f3(p * 2.7) - 0.014 * length(p - vec2(0.65, 0.32));
  vec3 color = vec3(bg * 0.98, bg * 0.99, bg) + grain * 0.4;

  float td = topSDF(p);
  float jag = (fbm(p * 130.0) - 0.5) * 0.007 + (noise(p * 520.0) - 0.5) * 0.0018 * fineFade;
  float topMask = 1.0 - smoothstep(-aa, aa, td + jag);
  float skyline = ridgeY(p.x) + (f3(vec2(p.x * 110.0, 9.0)) - 0.5) * 0.008;
  float mainMask = smoothstep(-aa, aa, p.y - skyline);
  float allMask = max(topMask, mainMask);

  if (allMask > 0.001) {
    float fd = faceSDF(p + (vec2(f3(p * 37.0), f3(p * 33.0 + 8.0)) - 0.5) * 0.012);
    float face = 1.0 - smoothstep(-0.005, 0.005, fd);
    float right = smoothstep(0.65, 0.71, p.x) * smoothstep(0.39, 0.46, p.y);
    float pillar = smoothstep(0.525, 0.555, p.x) * (1.0 - smoothstep(0.74, 0.81, p.x)) *
                   smoothstep(0.647, 0.686, p.y) * (1.0 - smoothstep(0.86, 0.89, p.y));
    float frontY = 0.795 + 0.19 * p.x + 0.015 * sin(p.x * 10.0) + (fbm(p * 25.0) - 0.5) * 0.014;
    float foreground = smoothstep(-0.005, 0.005, p.y - frontY);
    float topFaceEdge = 0.535 + 0.55 * (p.y - 0.070) + (noise(vec2(p.y * 36.0, 17.0)) - 0.5) * 0.009;
    float topDark = smoothstep(-0.002, 0.002, p.x - topFaceEdge);
    float upper = topMask * (1.0 - mainMask);

    vec3 material = vec3(1.00, 0.88, 3.6);
    if (face > 0.5) material = vec3(0.93, 0.34, 8.0);
    if (right > 0.5) material = vec3(0.83, 1.55, 17.0);
    if (pillar > 0.5) material = vec3(1.41, 0.95, 23.0);
    if (foreground > 0.5) material = vec3(0.28, 1.25, 31.0);
    if (upper > 0.5) material = topDark > 0.5 ? vec3(1.23, 0.24, 49.0) : vec3(0.56, 0.92, 43.0);

    // Smooth orbiting studio key light responding cleanly to pointer without warping stone silhouettes.
    vec3 L = normalize(vec3(
      -0.62 + 0.22 * sin(t * 0.42) + u_ptr.x * 0.36,
      -0.44 + 0.16 * cos(t * 0.34) - u_ptr.y * 0.28,
      0.38
    ));
    vec3 rock = slateRock(p, material.x, material.y, material.z, L, fineFade);

    // Smooth analytical cast shadow from the upper overhanging ledge onto the recessed face below.
    float overhangShadow = 1.0 - 0.44 * exp(-max(td, 0.0) / (0.032 + 0.012 * max(-L.y, 0.0))) * mainMask * (1.0 - upper);
    if (u_quality > 0.45 && td > -0.015 && td < 0.085) {
      float tdShift = topSDF(p + L.xy * 0.022);
      float penumbra = 1.0 - 0.34 * (1.0 - smoothstep(-0.010, 0.024, tdShift)) * mainMask * (1.0 - upper);
      overhangShadow = min(overhangShadow, penumbra);
    }

    // Grazing studio ridges on the left cliff, right shoulder, and overhang rim.
    float leftDrift = 0.020 * sin(t * 0.40) + u_ptr.x * 0.024;
    float faceSwell = exp(-pow((p.x - (0.04 + leftDrift + 0.60 * (p.y - 0.25))) / 0.088, 2.0));
    float leftStreaks = 0.22 + 1.15 * pow(noise(rotate(0.99) * (p + 8.0) * vec2(7.0, 62.0)), 2.0);
    rock += vec3(0.11, 0.12, 0.13) * faceSwell * leftStreaks * (1.0 - smoothstep(0.27, 0.70, p.y)) * face * (1.0 - upper) * (1.0 - foreground);

    float slopeX = 0.704 + 0.88 * (p.y - 0.416) + 0.020 * cos(t * 0.36) - u_ptr.x * 0.018;
    float slope = exp(-pow((p.x - slopeX) / 0.048, 2.0)) * smoothstep(0.41, 0.48, p.y);
    float rightStreaks = 0.22 + 2.25 * pow(noise(rotate(0.83) * (p + 17.0) * vec2(9.0, 76.0)), 2.0);
    rock += vec3(0.46, 0.44, 0.41) * slope * rightStreaks * exp(-max(p.y - 0.44, 0.0) * 2.3) * right * (1.0 - pillar) * (1.0 - foreground);

    float overhangRim = exp(-abs(td) / 0.011) * (1.0 - topDark) * upper;
    rock += vec3(0.07, 0.072, 0.078) * overhangRim;
    rock *= (1.0 - 0.46 * exp(-abs(td) / 0.018) * upper) * overhangShadow;
    rock = rock * 1.40 + vec3(0.024, 0.024, 0.026);

    // Fractured glowing gold fissure and warm reflected light on neighboring rock.
    float band = mineralBand(p);
    float fissureGlow = exp(-pow(max(band - 0.25, 0.0) * 1.15, 2.0));
    float spillGlow = exp(-max(band - 0.5, 0.0) * 0.38);

    // Voronoi rock shards inside the fissure so the gold breaks cleanly between black stone fragments.
    float crackCore = 0.0;
    float shardCut = 1.0;
    if (band < 4.5) {
      vec2 vc = cell((p + vec2(f3(p * 42.0), f3(p * 39.0 + 10.0)) * 0.010) * vec2(84.0, 62.0));
      float shard = smoothstep(0.015, 0.090, vc.y);
      float darkIsland = smoothstep(0.62, 0.88, hash21(floor(p * 65.0)));
      shardCut = mix(1.0, shard, 0.85 * darkIsland + 0.45 * smoothstep(0.75, 1.35, band));
      // Capillary cracks branching off the main pocket.
      crackCore = (1.0 - smoothstep(0.015, 0.11, vc.y)) * exp(-max(band - 0.8, 0.0) * 0.75);
    }

    float mineral = max(1.0 - smoothstep(0.62, 1.24, band), crackCore * 0.78) * shardCut;
    mineral = max(mineral, fineVeins(p) * 0.85);

    // Central luminous cavity and throat pocket with a slow travelling thermal wave along the vein.
    float cavity = exp(-dot((p - vec2(0.47, 0.83)) * vec2(12.0, 26.0), (p - vec2(0.47, 0.83)) * vec2(12.0, 26.0)));
    float throat = exp(-dot((p - vec2(0.695, 0.39)) * vec2(30.0, 14.0), (p - vec2(0.695, 0.39)) * vec2(30.0, 14.0)));
    float veinWave = exp(-pow(sin(p.y * 2.6 - t * 0.48 + p.x * 0.7), 2.0) * 3.4);
    float shimmer = 0.80 + 0.36 * veinWave + 0.10 * sin(t * 0.85 - p.y * 5.2 + p.x * 3.1);

    // Warm golden light spilling onto nearby rock planes and mist around the lower pocket.
    rock += vec3(0.55, 0.37, 0.14) * spillGlow * 0.36 * shimmer * (0.4 + 0.6 * rock.x * 8.0);
    rock += vec3(0.48, 0.33, 0.15) * cavity * 0.24 * shimmer;

    float tex = f3(p * 230.0) + 0.22 * noise(p * 680.0) * fineFade;
    float hot = clamp(0.50 + 0.55 * tex + 0.42 * cavity + 0.30 * throat, 0.0, 1.25) * shimmer;
    vec3 goldAmber = vec3(0.925, 0.72, 0.42) * hot; // aligned with --m-kerf #ecc583
    vec3 goldCore  = vec3(1.0, 0.94, 0.80) * smoothstep(0.75, 1.30, hot);
    vec3 mineralCol = mix(goldAmber, goldCore, 0.48);

    // Darken immediate bevel shadow around the crack before adding luminous mineral.
    rock *= 1.0 - 0.45 * exp(-pow((band - 1.15) * 1.8, 2.0));
    rock = mix(rock, mineralCol, clamp(mineral, 0.0, 1.0));
    rock += vec3(0.92, 0.74, 0.44) * fissureGlow * 0.20 * shimmer * shardCut;
    rock += grain * 0.55;

    color = mix(color, rock, allMask);
  }

  color *= 1.0 - 0.08 * pow(length((p - 0.5) * 1.4), 2.0);
  fragColor = vec4(finishColor(color, u_amp, u_band), 1.0);
}
`;

const TAPER_FS = `${PREAMBLE}
vec2 saltOff(float salt) { return vec2(fract(salt * 0.137) * 97.3, fract(salt * 0.293) * 113.7); }
float rnd(vec2 ip, float salt) { return hash21f(ip + saltOff(salt)); }
vec3 nd(vec2 p, float salt) {
  vec2 ip = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 dw = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 off = saltOff(salt);
  float a = hash21f(ip + off), b = hash21f(ip + vec2(1.0, 0.0) + off);
  float c = hash21f(ip + vec2(0.0, 1.0) + off), d = hash21f(ip + vec2(1.0, 1.0) + off);
  return vec3(
    mix(mix(a, b, w.x), mix(c, d, w.x), w.y),
    dw.x * mix(b - a, d - c, w.y),
    dw.y * mix(c - a, d - b, w.x)
  );
}
float noise(vec2 p, float salt) {
  vec2 ip = floor(p), f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  vec2 off = saltOff(salt);
  return mix(
    mix(hash21f(ip + off), hash21f(ip + vec2(1.0, 0.0) + off), w.x),
    mix(hash21f(ip + vec2(0.0, 1.0) + off), hash21f(ip + vec2(1.0, 1.0) + off), w.x),
    w.y
  );
}
float fbm(vec2 p, float salt) {
  float sum = 0.0, a = 0.56;
  mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
  sum += a * noise(p, salt); p = R * p * 2.03 + vec2(3.7, 9.2); a *= 0.49;
  sum += a * noise(p, salt + 17.0);
  if (u_quality > 0.40) {
    p = R * p * 2.03 + vec2(3.7, 9.2); a *= 0.49;
    sum += a * noise(p, salt + 37.0);
    return sum / 0.968;
  }
  return sum / 0.834;
}
float aaStep() { return max(0.0002, 0.7 / max(min(u_res.x, u_res.y), 1.0)); }
float insideRect(vec2 p, vec4 b) {
  vec2 d = min(p - b.xy, b.zw - p);
  return smoothstep(-aaStep(), aaStep(), min(d.x, d.y));
}
float line(float d, float width) {
  return 1.0 - smoothstep(width - aaStep(), width + aaStep(), abs(d));
}

vec3 stone(vec2 p, float rough, float illum, float id, vec3 lightDir, float fineFade) {
  vec2 offset = vec2(mod(id, 71.0) * 1.39, mod(id, 47.0) * 1.71);
  vec2 q = p + offset;
  float polished = 1.0 - smoothstep(0.86, 1.85, rough);
  float broad = fbm(q * 7.7, id);
  vec2 warp = vec2(noise(q * 16.0, id + 11.0), noise(q * 14.0 + 3.7, id + 27.0));
  vec2 folded = vec2(q.x * 1.36 + q.y * 0.24, q.y * 0.76) + warp * 0.024;
  float folds = fbm(folded * 58.0, id + 71.0);
  mat2 R1 = mat2(0.7986, 0.6018, -0.6018, 0.7986);
  mat2 R2 = mat2(0.9563, -0.2924, 0.2924, 0.9563);
  mat2 R3 = mat2(0.3256, 0.9455, -0.9455, 0.3256);
  vec3 g1 = nd(R1 * q * 303.0, id + 101.0);
  vec3 g2 = nd(R2 * q * 791.0, id + 131.0);
  vec3 g3 = fineFade > 0.35 ? nd(R3 * q * 1583.0, id + 151.0) : vec3(0.5, 0.0, 0.0);
  vec2 gradient = (
    transpose(R1) * g1.yz * mix(0.56, 0.20, polished) +
    transpose(R2) * g2.yz * 0.73 +
    transpose(R3) * g3.yz * mix(0.37, 0.58, polished) * fineFade
  ) * rough;
  vec3 longGrain = nd(folded * 91.0, id + 181.0);
  gradient += longGrain.yz * vec2(0.9, 0.35) * rough * mix(0.5, 0.05, polished);
  float craggy = smoothstep(1.45, 2.10, rough);
  if (craggy > 0.01) {
    vec2 buckle = folded + vec2(warp.x * 0.095 + noise(q * 4.3, id + 193.0) * 0.075, warp.y * 0.019);
    vec3 wrinkles = nd(buckle * vec2(43.0, 13.0), id + 191.0);
    gradient = mix(gradient, gradient * 0.85 + wrinkles.yz * vec2(2.4, 0.85), craggy * 0.68);
  }
  vec3 n = normalize(vec3(-gradient.x, -gradient.y, 1.0));
  vec3 halfDir = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float diffuse = max(dot(n, lightDir), 0.0);
  float glint = pow(max(dot(n, halfDir), 0.0), 24.0);
  float grain = 0.64 + g2.x * 0.66 + g3.x * 0.23 * fineFade;
  float foldedRelief = mix(mix(0.76, 1.36, smoothstep(0.25, 0.68, folds)), 1.0, polished * 0.72);
  float luminance = (mix(0.020, 0.030, polished) + diffuse * mix(0.060, 0.050, polished) + glint * mix(0.172, 0.045, polished)) * grain * foldedRelief;
  luminance *= mix(mix(0.63, 1.25, broad), 0.96, polished * 0.80) * illum;
  vec3 col = vec3(0.54, 0.87, mix(0.84, 0.94, polished)) * luminance;
  col += vec3(0.0023, 0.0032, 0.0037) * illum;
  return col;
}

void main() {
  if (u_scrub > 0.995) { fragColor = vec4(scrubLattice(gl_FragCoord.xy), 1.0); return; }
  float aspect = u_res.x / max(u_res.y, 1.0);
  // Shift focal center left on narrow phones so the illuminated teal edge stays inside the viewport.
  vec2 focus = vec2(mix(0.36, 0.50, clamp((aspect - 0.55) / 0.70, 0.0, 1.0)), 0.47);
  vec2 p = materialUV(gl_FragCoord.xy, u_res, focus, u_band);
  float t = u_time;
  float fineFade = clamp(u_res.x / 1500.0, 0.35, 1.0) * smoothstep(0.25, 0.95, u_px) * mix(0.55, 1.0, clamp(u_quality, 0.0, 1.0));

  // Calm architectural studio key light gliding over locked limestone planes (zero UV ghosting).
  vec3 lightDir = normalize(vec3(
    -0.80 + 0.18 * sin(t * 0.40) + u_ptr.x * 0.32,
    -0.26 + 0.14 * cos(t * 0.32) - u_ptr.y * 0.24,
    0.34
  ));
  float stripPulse = 0.80 + 0.34 * exp(-pow(sin(p.y * 2.8 - t * 0.54), 2.0) * 2.8) + 0.08 * sin(p.y * 4.4 + t * 0.46);
  float rimSheen = 0.82 + 0.32 * exp(-pow(sin(p.y * 2.5 + t * 0.44), 2.0) * 2.6);

  vec3 col = vec3(0.0);
  float aa = aaStep();

  // Mutually-exclusive slab dispatch: stone() evaluates at most ONCE per pixel (3x faster on mobile GPUs).
  float faceRight = 0.5663 - 0.0021 * smoothstep(0.32, 0.80, p.y);
  float faceTop = 0.3015 + 0.0032 * smoothstep(0.141, 0.567, p.x);
  float faceBottom = 0.8301;

  if (p.x < 0.0755 && p.y < 0.642) {
    float wallLight = 0.72 + 0.82 * exp(-pow((p.x - 0.075) / 0.085, 2.0));
    col = stone(p, 1.0, wallLight * 1.85, 110.0, lightDir, fineFade) * vec3(0.325, 1.12, 1.05);
  } else if (p.x >= 0.0755 && p.x < 0.1035 && p.y < 0.642) {
    col = stone(p, 0.67, 1.24 * stripPulse, 201.0, lightDir, fineFade) * vec3(0.48, 1.10, 1.10);
  } else if (p.x >= 0.1035 && p.x < 0.141 && p.y < 0.642) {
    float edgeNoise = fbm(vec2(p.x * 88.0, p.y * 44.0), 280.0);
    vec3 sideTexture = stone(p, 1.12, 4.85 * stripPulse, 291.0, lightDir, fineFade);
    float broadSide = 0.36 + 0.16 * edgeNoise;
    vec3 side = sideTexture * 1.05 + vec3(0.06, 0.23, 0.24) * broadSide * stripPulse;
    side += vec3(0.12, 0.24, 0.24) * exp(-pow((p.x - 0.137) / 0.0048, 2.0)) * stripPulse;
    side *= 0.80 + 0.22 * noise(p * vec2(71.0, 13.0), 261.0);
    side = side * 0.68 + vec3(0.10, 0.29, 0.30) * (0.91 + 0.09 * edgeNoise);
    side *= 0.72 + 0.55 * mix(0.5, noise(p * 743.0, 299.0), fineFade);
    col = side * vec3(1.10, 1.03, 1.02);
  } else if (p.x < 0.142 && p.y >= 0.642) {
    col = stone(p, 1.05, 0.72, 804.0, lightDir, fineFade);
  } else if (p.x >= 0.141 && p.x < faceRight && p.y >= faceTop && p.y < faceBottom) {
    float centerIllum = 0.68 + 0.28 * smoothstep(0.58, 0.83, p.y) + 0.15 * smoothstep(0.17, 0.55, p.x);
    centerIllum *= (0.82 + 0.36 * fbm(p * 6.5, 1022.0)) * (1.06 + 0.12 * sin(t * 0.40 - p.y * 2.4));
    vec3 faceCol = stone(p, 0.78, centerIllum, 1001.0, lightDir, fineFade);
    float diagonalShadow = smoothstep(0.566, 0.573, p.x + 1.21 * (p.y - 0.641)) * smoothstep(0.635, 0.647, p.y);
    col = faceCol * (1.0 - 0.91 * diagonalShadow);
  } else if (p.x >= 0.141 && p.x < 0.555 && p.y < faceTop) {
    float upperLight = 2.65 * (0.92 + 0.14 * sin(t * 0.38 + p.y * 2.2));
    float upperShadow = smoothstep(0.26, 0.41, p.x + 0.12 * p.y + 0.022 * sin(t * 0.36) - u_ptr.x * 0.024);
    upperLight *= (1.0 - 0.90 * upperShadow) * (0.82 + 0.30 * smoothstep(0.18, 0.29, p.y));
    col = stone(p, 0.96, upperLight, 401.0, lightDir, fineFade) * vec3(0.86, 0.93, 0.84);
    float scratch = p.y - (0.101 + 0.61 * (p.x - 0.193) + noise(vec2(p.x * 79.0, 6.7), 407.0) * 0.0018);
    col += vec3(0.022, 0.036, 0.031) * exp(-abs(scratch) / 0.00064) * smoothstep(0.193, 0.202, p.x) * (1.0 - smoothstep(0.287, 0.299, p.x));
  } else if (p.x >= 0.155 && p.x < 0.580 && p.y >= faceBottom) {
    float lowShadow = smoothstep(0.34, 0.57, p.x - 0.09 * (p.y - 0.83));
    col = stone(p, 1.20, 1.28 * (1.0 - 0.92 * lowShadow), 901.0, lightDir, fineFade);
  } else if (p.x >= 0.580 && p.y < 0.1835) {
    vec2 ruv = vec2(p.x * 1.30 - p.y * 0.26, p.y * 0.66);
    float upperRightLight = 1.18 + 0.52 * smoothstep(0.59, 1.0, p.x) + 0.16 * cos(p.x * 4.6 - t * 0.38);
    col = stone(ruv, 1.87, upperRightLight, 611.0, lightDir, fineFade);
  } else if (p.x >= 0.562 && p.y >= 0.181 && p.y < 0.6415) {
    float rightLight = 1.18 + 0.58 * smoothstep(0.68, 0.96, p.x) + 0.18 * sin(p.y * 3.8 + t * 0.42);
    vec3 rightCol = stone(p, 1.22, rightLight, 510.0, lightDir, fineFade) * vec3(1.05, 1.10, 1.04);
    rightCol *= 1.0 - 0.77 * exp(-max(p.y - 0.183, 0.0) / 0.026);
    float towerCast = 1.0 - 0.48 * exp(-max(p.x - 0.566, 0.0) / (0.044 + 0.016 * (1.0 + u_ptr.x))) * smoothstep(0.29, 0.34, p.y);
    col = rightCol * towerCast;
  } else if (p.x >= 0.580 && p.y >= 0.6415) {
    float bottomIllum = 1.72 + 0.34 * smoothstep(0.65, 0.95, p.y) + 0.16 * sin(p.x * 4.2 - t * 0.36);
    vec2 bottomUV = vec2(p.x * 1.23 - p.y * 0.24, p.y * 0.72);
    vec3 bottom = stone(bottomUV, 2.14, bottomIllum, 710.0, lightDir, fineFade);
    float bigTroughs = fbm(vec2(p.x * 34.0 + p.y * 15.0, p.y * 9.0), 717.0);
    col = bottom * mix(0.41, 1.50, smoothstep(0.25, 0.68, bigTroughs));
  }

  // Architectural seams, bevel glints, and corner specular ticks (purely cheap analytical lines).
  col *= 1.0 - 0.72 * line(p.x - 0.0749, 0.0011) * step(p.y, 0.643);
  col += vec3(0.12, 0.38, 0.38) * line(p.x - 0.0757, 0.00028) * step(p.y, 0.642) * stripPulse;
  col += vec3(0.12, 0.43, 0.44) * line(p.x - 0.1023, 0.00039) * step(p.y, 0.642) * stripPulse;
  col += vec3(0.26, 0.68, 0.68) * line(p.x - 0.1046, 0.00042) * step(p.y, 0.641) * stripPulse;
  col += vec3(0.34, 0.50, 0.47) * line(p.x - 0.1403, 0.00060) * step(p.y, 0.640) * rimSheen;
  float sideJoin = 0.3076 - (p.x - 0.104) * 0.185;
  float joinMask = step(0.104, p.x) * step(p.x, 0.141);
  col *= 1.0 - 0.76 * line(p.y - sideJoin, 0.00080) * joinMask;
  col += vec3(0.21, 0.48, 0.47) * line(p.y - sideJoin + 0.0008, 0.00028) * joinMask;

  col += vec3(0.20, 0.36, 0.34) * line(p.x - 0.1406, 0.00044) * step(p.y, 0.303);
  col *= 1.0 - 0.75 * exp(-pow((p.x - 0.5555) / 0.0055, 2.0)) * step(p.y, 0.303);

  col += vec3(0.07, 0.27, 0.26) * line(p.x - 0.5807, 0.00055) * step(p.y, 0.183);
  col += vec3(0.09, 0.17, 0.15) * line(p.x - 0.9747, 0.00036) * step(p.y, 0.183);
  col += vec3(0.018, 0.047, 0.045) * line(p.y - 0.1829, 0.00065) * step(0.580, p.x);
  col *= 1.0 - 0.52 * line(p.y - 0.1846, 0.0011) * step(0.58, p.x);

  float rightSeam = 0.9585 - 0.0012 * p.y;
  col *= 1.0 - 0.56 * line(p.x - rightSeam, 0.0014) * step(0.188, p.y) * step(p.y, 0.638);
  col += vec3(0.31, 0.43, 0.41) * line(p.x - rightSeam + 0.00072, 0.00028) * step(0.207, p.y) * step(p.y, 0.638);

  col += vec3(0.25, 0.49, 0.48) * line(p.x - 0.5807, 0.00050) * step(0.642, p.y);
  col += vec3(0.19, 0.32, 0.31) * line(p.y - 0.6404, 0.00034) * step(0.579, p.x);
  col *= 1.0 - 0.56 * line(p.x - 0.9466, 0.0011) * step(0.642, p.y);
  col += vec3(0.10, 0.23, 0.22) * line(p.x - 0.9475, 0.00030) * step(0.642, p.y);

  col += vec3(0.05, 0.20, 0.20) * line(p.y - 0.6417, 0.00048) * step(p.x, 0.141);
  col += vec3(0.10, 0.49, 0.49) * line(p.x - 0.1556, 0.00060) * step(0.830, p.y);
  col += vec3(0.17, 0.37, 0.36) * line(p.y - 0.8318, 0.00044) * step(0.155, p.x) * step(p.x, 0.56);
  col *= 1.0 - 0.62 * exp(-max(p.y - 0.831, 0.0) / 0.010) * step(0.16, p.x) * step(p.x, 0.57) * step(0.832, p.y);

  float topSpan = step(0.139, p.x) * step(p.x, 0.568);
  float sideSpan = step(faceTop, p.y) * step(p.y, faceBottom);
  float roughLine = 0.80 + 0.20 * noise(p * 1541.0, 1003.0);
  col += vec3(0.24, 0.42, 0.40) * line(p.y - faceTop, 0.00054) * topSpan * roughLine * rimSheen;
  col += vec3(0.31, 0.53, 0.51) * line(p.x - 0.1407, 0.00048) * sideSpan * roughLine * rimSheen;
  float rightFade = 1.0 - 0.91 * smoothstep(0.625, 0.654, p.y);
  col += vec3(0.68, 0.79, 0.75) * line(p.x - faceRight, 0.00061) * sideSpan * rightFade * roughLine * rimSheen;
  col += vec3(0.12, 0.24, 0.23) * line(p.y - faceBottom, 0.00044) * topSpan * roughLine;

  col += vec3(0.45, 0.78, 0.75) * exp(-length((p - vec2(0.141, 0.301)) * vec2(830.0, 1100.0))) * stripPulse;
  col += vec3(0.20, 0.56, 0.55) * exp(-length((p - vec2(0.156, 0.831)) * vec2(910.0, 1250.0))) * rimSheen;

  float grain = rnd(floor(p * 3072.0), 2001.0) - 0.5;
  col += grain * 0.0028 * fineFade;
  fragColor = vec4(finishColor(col, u_amp, u_band), 1.0);
}
`;

const CHAMFER_FS = `${PREAMBLE}
vec2 saltOff(float salt) { return vec2(fract(salt * 0.173) * 89.1, fract(salt * 0.317) * 107.3); }
float noise(vec2 p, float salt) {
  vec2 i = floor(p), t = fract(p);
  t = t * t * (3.0 - 2.0 * t);
  vec2 off = saltOff(salt);
  return mix(
    mix(hash21f(i + off), hash21f(i + vec2(1.0, 0.0) + off), t.x),
    mix(hash21f(i + vec2(0.0, 1.0) + off), hash21f(i + vec2(1.0, 1.0) + off), t.x),
    t.y
  );
}
vec3 nd(vec2 p, float salt) {
  vec2 i = floor(p), f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  vec2 dw = 6.0 * f * (1.0 - f);
  vec2 off = saltOff(salt);
  float a = hash21f(i + off), b = hash21f(i + vec2(1.0, 0.0) + off);
  float c = hash21f(i + vec2(0.0, 1.0) + off), d = hash21f(i + vec2(1.0, 1.0) + off);
  return vec3(
    mix(mix(a, b, w.x), mix(c, d, w.x), w.y),
    dw.x * mix(b - a, d - c, w.y),
    dw.y * mix(c - a, d - b, w.x)
  );
}
// Analytical paper tooth gradient: 1 pass instead of 3 finite-difference evaluations (3x faster on mobile).
float paper(vec2 p, float illumination, float angle, float salt, float fineFade) {
  float s = sin(angle), c = cos(angle);
  vec2 q = mat2(c, -s, s, c) * p + salt * 0.034;
  vec3 n1 = nd(q * vec2(480.0, 760.0), 11.0);
  vec3 n2 = nd(q * vec2(1150.0, 1480.0), 29.0);
  float h = n1.x * 0.50 + n2.x * 0.38;
  vec2 dh = n1.yz * vec2(0.44, 0.68) * 0.34 + n2.yz * vec2(0.42, 0.52) * 0.42;
  if (fineFade > 0.35) {
    vec3 n3 = nd(q * 2520.0, 41.0);
    h += n3.x * 0.12 * fineFade;
    dh += n3.yz * 0.24 * fineFade;
  }
  float grains = clamp(0.49 + 0.72 * dot(dh, vec2(0.55, -0.85)), 0.0, 1.0);
  float sparkle = pow(grains, 3.9);
  float fibre = noise(vec2(q.x * 2350.0, q.y * 740.0), salt + 83.0);
  float low = noise(q * 42.0, salt + 17.0) * 0.60 + noise(q * 112.0, salt + 61.0) * 0.40;
  float micro = fineFade > 0.40 ? (hash21f(floor(q * 4800.0) + salt) - 0.5) * fineFade : 0.0;
  float structure = 0.64 + (h - 0.5) * 1.7 + 0.52 * dot(dh, vec2(0.55, -0.85)) + sparkle * 0.42 + (fibre - 0.5) * 0.30 + micro * 0.08;
  structure = mix(0.72, structure, 0.80 * mix(0.45, 1.0, fineFade));
  return max(0.0, illumination * structure * (0.85 + 0.30 * low));
}

void main() {
  if (u_scrub > 0.995) { fragColor = vec4(scrubLattice(gl_FragCoord.xy), 1.0); return; }
  vec2 p = materialUV(gl_FragCoord.xy, u_res, vec2(0.46, 0.48), u_band);
  float pixel = 1.0 / max(min(u_res.x, u_res.y), 1.0);
  float fineFade = smoothstep(0.25, 0.95, u_px) * mix(0.50, 1.0, clamp(u_quality, 0.0, 1.0));
  float t = u_time;

  // Razor-sharp stacked cotton-paper sheets illuminated by a gliding studio softbox.
  float slope = 0.711;
  float d = (p.x - (0.205 + slope * p.y)) / sqrt(1.0 + slope * slope);
  float topMask = smoothstep(-pixel * 0.55, pixel * 0.55, d);

  // Studio softbox sweep & subtle warm cotton raking light (only light moves, cut edges stay sharp).
  float sweepCoord = p.x * 0.72 - p.y * 0.55 - 0.10 + 0.24 * sin(t * 0.38) + u_ptr.x * 0.26 - u_ptr.y * 0.18;
  float sweep = 0.88 + 0.52 * exp(-pow(sweepCoord * 2.4, 2.0));
  float edgeSheen = 0.76 + 0.44 * exp(-pow(sin(p.y * 3.1 - t * 0.62), 2.0) * 3.0);

  float value = 0.0;
  if (topMask < 0.999) {
    vec2 a2 = vec2(-0.13, 0.895), b2 = vec2(0.386, 0.452);
    float d2 = dot(p - a2, normalize(vec2(-(b2 - a2).y, (b2 - a2).x)));
    float clip2 = 2.0 - p.x;
    float mask2 = smoothstep(-pixel, pixel, d2) * smoothstep(0.0, pixel, clip2);

    vec2 a = vec2(-0.1, 0.579), b = vec2(0.296, 0.314);
    vec2 tangent = normalize(b - a), normal = vec2(-tangent.y, tangent.x);
    float across = dot(p - a, normal);
    float along = dot(p - a, tangent);
    float upperMask = smoothstep(-pixel, pixel, across)
      * (1.0 - smoothstep(0.202 - pixel, 0.202 + pixel, across))
      * (1.0 - smoothstep(0.493, 0.497, along));

    if (upperMask < 0.999) {
      if (mask2 < 0.999) {
        float backLight = (0.008 + 0.011 * exp(-dot((p - vec2(0.04, 0.20)) * vec2(2.0, 1.5), (p - vec2(0.04, 0.20)) * vec2(2.0, 1.5)))) * (0.90 + 0.22 * sweep);
        value = paper(p, backLight, -0.12, 101.0, fineFade);
      }
      if (mask2 > 0.001) {
        float leftGlow = (0.064 + 0.056 * (1.0 - p.y) + 0.014 * (1.0 - p.x)) * sweep;
        value = mix(value, paper(p, leftGlow, 0.57, 201.0, fineFade), mask2);
      }
      float edge2 = exp(-pow(d2 / (pixel * 0.52 + 0.00020), 2.0));
      value += edge2 * (0.35 + 0.22 * (1.0 - p.x)) * smoothstep(0.01, 0.045, clip2) * (1.0 - smoothstep(0.65, 0.69, dot(p - a2, normalize(b2 - a2)))) * edgeSheen;
    }

    float contact = exp(-max(across - 0.202, 0.0) * 130.0) * step(0.202, across) * (1.0 - smoothstep(0.45, 0.49, along));
    value *= 1.0 - 0.72 * contact;
    if (upperMask > 0.001) {
      float middleLight = (0.094 + 0.028 * exp(-pow((p.x - 0.17) * 2.0, 2.0))) * sweep;
      value = mix(value, paper(p, middleLight, 0.52, 301.0, fineFade), upperMask);
    }
    float line1 = exp(-pow(across / (pixel * 0.54 + 0.00014), 2.0));
    value += line1 * (0.50 + 0.14 * noise(p * 220.0, 99.0)) * (1.0 - smoothstep(0.44, 0.49, along)) * edgeSheen;

    // Soft cast penumbra underneath the raised top sheet reacting gently to light angle.
    float gap = 0.024 + 0.004 * sin(t * 0.38) - 0.004 * u_ptr.x;
    float shadow = exp(-pow(max(-d, 0.0) / max(gap, 0.014), 0.72));
    value *= 1.0 - 0.94 * shadow;
    value *= 1.0 - 0.84 * exp(-dot((p - vec2(0.46, 0.47)) * vec2(9.0, 7.0), (p - vec2(0.46, 0.47)) * vec2(9.0, 7.0)));
  }

  if (topMask > 0.001) {
    vec2 pc = clamp(p, vec2(-0.15), vec2(1.15));
    float broad = max(0.014, ((0.26269294) + (0.19789924)*pc.y + (-1.64239981)*pc.x + (-0.34928535)*pc.y*pc.y + (-1.22674591)*pc.x*pc.y + (5.01777898)*pc.x*pc.x + (0.69970572)*pc.y*pc.y*pc.y + (-0.50706878)*pc.x*pc.y*pc.y + (1.35846301)*pc.x*pc.x*pc.y + (-4.95569238)*pc.x*pc.x*pc.x + (-0.84410177)*pc.y*pc.y*pc.y*pc.y + (1.32069473)*pc.x*pc.y*pc.y*pc.y + (-0.39752031)*pc.x*pc.x*pc.y*pc.y + (-0.63847640)*pc.x*pc.x*pc.x*pc.y + (1.75377372)*pc.x*pc.x*pc.x*pc.x) * 1.18);
    float plane = paper(p, broad * sweep, 0.85, 401.0, fineFade);
    plane *= 0.90 + 0.10 * noise(p * 9.0, 499.0);
    value = mix(value, plane, topMask);
  }

  float edgeWidth = 0.00032 + pixel * 0.25;
  float edge = exp(-pow(d / edgeWidth, 2.0));
  float edgeLight = (0.86 - 0.36 * p.y) * (0.90 + 0.10 * noise(p * 520.0, 411.0)) * edgeSheen;
  value += edge * edgeLight;

  float vignette = 1.0 - 0.09 * dot(p - 0.5, p - 0.5);
  vec3 color = vec3(value * vignette);
  fragColor = vec4(finishColor(color, u_amp, u_band), 1.0);
}
`;

const LATHE_FS = `${PREAMBLE}
float hash2(vec2 p) { return hash21f(p + vec2(37.1, 73.9)); }
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
vec2 grad2(vec2 p) {
  float a = hash2(p) * 6.2831853;
  return vec2(cos(a), sin(a));
}
float simplex(vec2 p) {
  const float F = 0.3660254038, G = 0.2113248654;
  vec2 i = floor(p + (p.x + p.y) * F);
  vec2 a = p - i + (i.x + i.y) * G;
  vec2 j = a.x > a.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - j + G, c = a - 1.0 + 2.0 * G;
  vec3 t = max(vec3(0.5) - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  t *= t; t *= t;
  float h = dot(t, vec3(dot(grad2(i), a), dot(grad2(i + j), b), dot(grad2(i + vec2(1.0)), c)));
  return clamp(0.5 + 35.0 * h, 0.0, 1.0);
}
float fbm(vec2 p) {
  float a = 0.54, r = 0.0;
  r += a * noise2(p); p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.03 + vec2(5.7, 1.3); a *= 0.5;
  r += a * noise2(p); p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.03 + vec2(5.7, 1.3); a *= 0.5;
  r += a * noise2(p);
  return r / 0.945;
}
float gauss(float x, float s) { return exp(-x * x / (s * s)); }

vec3 steelLight(vec2 p) {
  vec2 q = clamp(p, vec2(-0.1), vec2(1.1));
  float x = q.x - 0.65, y = q.y - 0.4;
  float x2 = x * x, y2 = y * y, x3 = x2 * x, y3 = y2 * y;
  vec3 c = vec3(0.16119, 0.11757, 0.20367);
  c += y * vec3(0.05568, 0.08835, 0.05987) + x * vec3(1.09222, 0.81047, 1.38315);
  c += y2 * vec3(-0.44412, -0.62003, -0.58621) + x * y * vec3(-2.42512, -2.26829, -2.894) + x2 * vec3(0.28902, 0.27361, 0.23943);
  c += y3 * vec3(-2.344, -2.73868, -2.66501) + x * y2 * vec3(-6.74761, -9.77029, -7.37114) + x2 * y * vec3(-14.11157, -18.45697, -14.71635) + x3 * vec3(-8.16509, -8.31825, -9.8454);
  c += y2 * y2 * vec3(1.02847, 0.34125, 1.69535) + x * y3 * vec3(-4.03534, -9.18166, -2.48218) + x2 * y2 * vec3(-11.56609, -25.94672, -8.54214) + x3 * y * vec3(-15.21589, -32.46354, -10.80581) + x2 * x2 * vec3(-9.01537, -13.60691, -9.00732);
  float l = max(0.005, dot(c, vec3(0.2126, 0.7152, 0.0722)));
  return max(vec3(0.004), mix(vec3(l) * vec3(0.98, 0.94, 1.04), c, smoothstep(0.01, 0.04, l)));
}

vec3 steel(vec2 p, vec2 lightShift, float fineFade) {
  vec2 N = normalize(vec2(1.0, 0.785));
  vec2 T = vec2(N.y, -N.x);
  float n = dot(p, N), t = dot(p, T);
  float bend = 0.003 * noise2(vec2(t * 2.0, 1.2));
  float line1 = noise2(vec2((n + bend) * 2200.0, t * 30.0));
  float line2 = noise2(vec2((n + bend) * 850.0, t * 10.0));
  float line3 = fineFade > 0.35 ? noise2(vec2((n + bend) * 4500.0, t * 65.0)) : 0.5;
  float brush = (line1 - 0.5) * 0.285 + (line2 - 0.5) * 0.105 + (line3 - 0.5) * 0.144 * fineFade;
  float darkCut = pow(noise2(vec2(n * 1200.0, t * 38.0 + 33.0)), 9.0);
  float cloud = fbm(vec2(n * 22.0, t * 5.0));
  vec3 c = steelLight(p + lightShift);
  float light = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c *= 0.97 + 0.06 * cloud;
  c += brush * sqrt(max(light, 0.004)) * mix(0.45, 1.0, fineFade) * vec3(1.0, 0.88, 1.1);
  c -= darkCut * 0.080 * light * fineFade;
  return c;
}

float slateBoundary(float y) {
  float drift = 0.012 * (noise2(vec2(y * 6.2, 23.0)) - 0.5);
  float splinter = 0.017 * (noise2(vec2(y * 35.0, 19.0)) - 0.5) + 0.005 * (noise2(vec2(y * 110.0, 27.0)) - 0.5);
  float chipped = -0.018 * gauss(y - 0.29, 0.025) + 0.012 * gauss(y - 0.35, 0.024) - 0.011 * gauss(y - 0.48, 0.021) + 0.014 * gauss(y - 0.62, 0.031) - 0.022 * gauss(y - 0.73, 0.033);
  return 0.595 - 0.675 * y - 0.035 * sin(y * 3.14159) + drift + splinter + chipped;
}

vec3 slate(vec2 p, float signedEdge, float shimmer, float fineFade, float t) {
  vec2 q = p * vec2(1.0, 1.15);
  float broad = fbm(q * 9.0);
  float medium = noise2(q * 75.0 + broad * 3.0);
  vec2 rockCoord = q * 310.0 + vec2(broad * 13.0, medium * 4.0);
  vec2 secondary = mat2(0.8, 0.6, -0.6, 0.8) * q * 680.0;
  float pebble = 0.82 * noise2(rockCoord) + 0.18 * noise2(secondary);
  float dust = fineFade > 0.35 ? noise2(q * 1390.0) : 0.5;
  float directional = 0.82 * noise2(q * 310.0 + vec2(0.8, -0.7)) + 0.18 * noise2(secondary + vec2(0.4, -0.5)) - pebble;
  float topo = clamp(0.32 + 1.45 * directional + 0.55 * (pebble - 0.45), 0.0, 1.0);
  float spec = pow(topo, 4.2);
  float illumination = (0.012 + 0.68 * exp(-pow((p.x - 0.54) / 0.32, 2.0) - p.y * 0.92)) * (0.86 + 0.22 * shimmer);
  illumination *= 0.6 + 0.65 * broad;
  float granular = 0.17 + 0.45 * topo + 0.65 * spec;
  granular *= 0.65 + 0.45 * medium;
  float base = illumination * mix(0.52, granular, mix(0.45, 1.0, fineFade));
  float crevice = 1.0 - 0.45 * pow(1.0 - noise2(vec2(q.x * 75.0 + broad * 8.0, q.y * 140.0)), 5.0);
  vec3 c = base * vec3(0.97, 0.58, 1.27) * crevice;
  c += vec3((dust - 0.5) * 0.010 * fineFade);

  float lip = 1.0 - smoothstep(0.002, 0.056, -signedEdge);
  if (lip > 0.001) {
    float facet = fbm(vec2(p.x * 78.0, p.y * 90.0));
    float crystal = pow(dust, 8.0) * 6.0 + pow(simplex(q * 460.0), 10.0) * 2.0;
    float crack = pow(clamp(1.0 - abs(simplex(p * vec2(90.0, 70.0)) - 0.48) * 4.0, 0.0, 1.0), 8.0);
    float edgeLight = (0.045 + 0.86 * gauss(p.y - 0.68, 0.14) + 0.20 * gauss(p.y - 0.37, 0.08)) * (0.82 + 0.32 * shimmer);
    float crystalGlint = 0.55 + 0.70 * pow(0.5 + 0.5 * sin(t * 1.10 + facet * 14.0 + dust * 6.2831 - p.y * 5.0), 2.0);
    float cutShade = 0.12 + 0.55 * pow(facet, 3.0);
    vec3 edgeColor = c * cutShade + vec3(0.86, 0.71, 1.02) * edgeLight * crystal * crystalGlint * (0.3 + 1.7 * medium) * (0.35 + 1.4 * crack);
    c = mix(c, edgeColor, lip);
    c += vec3(0.12, 0.09, 0.17) * pow(pebble, 14.0) * crystalGlint * lip * fineFade;
  }
  return c;
}

void main() {
  if (u_scrub > 0.995) { fragColor = vec4(scrubLattice(gl_FragCoord.xy), 1.0); return; }
  vec2 p = materialUV(gl_FragCoord.xy, u_res, vec2(0.55, 0.44), u_band);
  float aa = 1.0 / max(min(u_res.x, u_res.y), 1.0);
  float fineFade = smoothstep(0.25, 0.95, u_px) * mix(0.50, 1.0, clamp(u_quality, 0.0, 1.0));
  float t = u_time;

  // Anisotropic brushed steel & cleaved amethyst slate under a gliding studio key light (zero stepped parallax artifacts).
  vec2 lightShift = vec2(sin(t * 0.44), cos(t * 0.34)) * 0.064 + vec2(u_ptr.x * 0.085, -u_ptr.y * 0.068);
  float shimmer = exp(-pow(sin(p.y * 2.6 - t * 0.60 + p.x * 1.2), 2.0) * 3.0) * 2.0 - 0.5;
  float anisoWave = 0.82 + 0.34 * exp(-pow(sin((p.x * 1.15 + p.y * 0.65) * 2.8 - t * 0.54 + u_ptr.x * 0.85), 2.0) * 2.8);

  vec3 c = vec3(0.0024);
  float d = (p.x + 0.7772345 * p.y + 0.0086779 * p.y * p.y - 1.1234846) / 1.2715;
  float metalMask = 1.0 - smoothstep(-aa, aa, d);
  float e = (p.x - slateBoundary(p.y)) / 1.20;
  float rockMask = 1.0 - smoothstep(-aa, aa, e);

  if (metalMask > 0.001 && rockMask < 0.999) {
    vec3 metal = steel(p, lightShift, fineFade) * anisoWave;
    // Crisp machined chamfer edge highlight along the cut slope.
    float rim = exp(-pow((d + 0.0008) / max(0.0008, aa * 0.7), 2.0));
    float bevelSheen = exp(-pow((d + 0.0022) / 0.0028, 2.0)) * 0.32;
    float rimLight = (0.008 + 0.62 * exp(-2.60 * p.y)) * (0.80 + 0.20 * noise2(p * vec2(32.0, 25.0))) * (0.78 + 0.38 * max(0.0, shimmer));
    metal += (rim + bevelSheen) * rimLight * vec3(0.98, 0.76, 1.16);
    c = mix(c, metal, metalMask);
  }
  if (rockMask > 0.001) {
    vec3 slateCol = slate(p, e, shimmer, fineFade, t);
    // Soft cast shadow from the raised brushed-steel plate over the adjacent crystal cleavage.
    float edgeDist = clamp(-e, 0.0, 0.045);
    float castDrop = 1.0 - 0.42 * exp(-edgeDist * 125.0);
    c = mix(c, slateCol * castDrop, rockMask);
  }
  fragColor = vec4(finishColor(c, u_amp, u_band), 1.0);
}
`;

const SHADERS: Record<ModuleMaterialId, string> = {
  kerf: KERF_FS,
  taper: TAPER_FS,
  chamfer: CHAMFER_FS,
  lathe: LATHE_FS,
};

export function moduleFragmentShader(id: ModuleMaterialId): string {
  return SHADERS[id];
}
