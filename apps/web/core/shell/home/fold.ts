/**
 * Height of the relief's folds while the surface changes from one module to
 * another, as a state that never jumps. `p` runs 0..1 (flat..full height);
 * `form` is the surface being drawn, `want` the one asked for last.
 *
 * While `form` is not `want` the folds go down from wherever they are; at the
 * bottom, where nothing is visible, the form switches straight to the latest
 * choice; then they rise. A choice made in the middle of a change therefore
 * continues from the current height instead of restarting the change (which
 * used to snap the folds back up and show the previous surface again).
 */
export interface FoldState { p: number; form: string; want: string }

export function stepFold(s: FoldState, dtMs: number, halfMs: number): FoldState {
  const step = Math.max(0, dtMs) / Math.max(1, halfMs);
  if (s.form !== s.want) {
    const p = s.p - step;
    return p > 0 ? { ...s, p } : { p: 0, form: s.want, want: s.want };
  }
  if (s.p >= 1) return s;
  return { ...s, p: Math.min(1, s.p + step) };
}

/** Eased height for a linear `p`: soft at the top and at the bottom. */
export const foldHeight = (p: number): number => p * p * (3 - 2 * p);
