/** Pure decisions shared by the homepage engines; kept apart so they can be tested. */

export type Move = 'stay' | 'slide' | 'fade' | 'up' | 'down';

/**
 * How every word gets from its old place to its new one when the paragraph
 * re-wraps. `first` and `last` are the places before and after, in reading
 * order; `tol` is how far apart two tops may be and still be one line.
 *
 * A word slides only along its own line. A word that ends up on another line
 * fades out there and in here: a diagonal flight crosses the text that is
 * being edited. A word that moves straight up or down is reported as such: one
 * going down leaves room for what is written and has to go first, one going up
 * takes the room of what was erased and has to go last. A word that keeps its line but would
 * have to cross most of it slides only if a neighbour travels with it (an
 * insertion pushing the line along); alone, it fades as well.
 */
export function planMoves(
  first: { left: number; top: number }[],
  last: { left: number; top: number }[],
  width: number,
  tol: number,
): Move[] {
  const together = (i: number, j: number) =>
    j >= 0 && j < first.length &&
    Math.abs(first[i].top - first[j].top) <= tol && Math.abs(last[i].top - last[j].top) <= tol;
  return first.map((from, i) => {
    const dx = Math.abs(from.left - last[i].left);
    const dy = Math.abs(from.top - last[i].top);
    if (dx <= 0.5 && dy <= 0.5) return 'stay';
    if (dy > 0.5) return dx > 0.5 ? 'fade' : last[i].top > from.top ? 'down' : 'up';
    if (dx <= width * 0.3) return 'slide';
    return together(i, i - 1) || together(i, i + 1) ? 'slide' : 'fade';
  });
}

/**
 * Backing-store size of the relief canvas: at most `budget` pixels, never
 * above twice the CSS size, never too small to draw.
 */
export function renderSize(cssW: number, cssH: number, dpr: number, budget: number): [number, number] {
  const k = Math.min(Math.min(dpr || 1, 2), Math.sqrt(budget / Math.max(1, cssW * cssH)));
  return [Math.max(160, Math.round(cssW * k)), Math.max(100, Math.round(cssH * k))];
}

/** Position of a date on an axis, in percent of the span. */
export function axisPercent(iso: string, fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  return ((Date.parse(iso) - from) / (Date.parse(toIso) - from)) * 100;
}

/** Push marks apart so that neighbours are at least `minGap` percent away. */
export function spreadMarks(percents: number[], minGap: number): number[] {
  const out: number[] = [];
  for (const p of percents) {
    const prev = out.length ? out[out.length - 1] : -Infinity;
    out.push(p - prev < minGap ? Math.round((prev + minGap) * 1e6) / 1e6 : p);
  }
  return out;
}

/**
 * Clickable zone of every axis mark, in percent: at most `half` to each side,
 * and never past the midpoint to a neighbour, so close marks stay separately
 * reachable.
 */
export function markZones(marks: number[], half: number): { from: number; to: number }[] {
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return marks.map((m, i) => ({
    from: r(i > 0 ? Math.max(m - half, (marks[i - 1] + m) / 2) : m - half),
    to: r(i < marks.length - 1 ? Math.min(m + half, (m + marks[i + 1]) / 2) : m + half),
  }));
}

export type ReliefPreset = Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g', number[]>;

/** Linear blend of two relief presets, channel by channel. */
export function lerpPreset(from: ReliefPreset, to: ReliefPreset, k: number): ReliefPreset {
  const mix = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * k);
  return {
    a: mix(from.a, to.a), b: mix(from.b, to.b), c: mix(from.c, to.c), d: mix(from.d, to.d),
    e: mix(from.e, to.e), f: mix(from.f, to.f), g: mix(from.g, to.g),
  };
}

