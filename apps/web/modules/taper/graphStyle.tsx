/**
 * Presentation vocabulary of the Taper views — what a colour, a shape and
 * a dash pattern MEAN. One table for the canvas, the outline and the legend,
 * so the three can never disagree.
 *
 *   hue    de = German administration · court = German justice · eu = EU
 *   shape  dot = authority · diamond = court · ring = view group (no office)
 *   line   ink = recorded structure · court = route through the courts ·
 *          oversight = supervision and control · political = accountability
 *
 * Three hues per mark type is deliberate: it is the most a scatter of small
 * marks keeps apart for colour-blind readers (checked for both surfaces);
 * everything finer is carried by shape, dash pattern and the legend.
 * No data, no layout — colours and strokes only.
 */

import React from 'react';

export type NodeHue = 'de' | 'court' | 'eu' | 'neutral';
export type NodeShape = 'dot' | 'diamond' | 'ring';
export type LineHue = 'ink' | 'court' | 'oversight' | 'political';

/** Hex per theme, plus the matching text-colour classes for DOM swatches. */
export const HUES: Record<Exclude<NodeHue, 'neutral'> | 'oversight',
  { light: string; dark: string; text: string }> = {
  de: { light: '#2a78d6', dark: '#3987e5', text: 'text-[#2a78d6] dark:text-[#3987e5]' },
  court: { light: '#eb6834', dark: '#d95926', text: 'text-[#eb6834] dark:text-[#d95926]' },
  eu: { light: '#1baf7a', dark: '#199e70', text: 'text-[#1baf7a] dark:text-[#199e70]' },
  oversight: { light: '#6250d6', dark: '#9085e9', text: 'text-[#6250d6] dark:text-[#9085e9]' },
};
const NEUTRAL_TEXT = 'text-[var(--c-text-muted)]';

const isCourtKind = (kind: string) =>
  kind.includes('gericht') || kind.includes('staatsanwalt');

export const nodeShape = (kind: string, virtual?: boolean): NodeShape =>
  virtual ? 'ring'
    : kind === 'eu_court' || isCourtKind(kind) ? 'diamond' : 'dot';

export const nodeHue = (kind: string, virtual?: boolean): NodeHue => {
  if (virtual) {
    // Groups are neutral; only the three entry points keep their domain hue.
    return kind === 'eu_hub' ? 'eu' : kind === 'de_hub' ? 'de'
      : kind === 'justiz' ? 'court' : 'neutral';
  }
  return kind.startsWith('eu_') ? 'eu' : isCourtKind(kind) ? 'court' : 'de';
};

/** Relation → line family and dash pattern (screen pixels; [] = solid). */
export const REL_LINES: Record<string, { hue: LineHue; dash: number[] }> = {
  parent: { hue: 'ink', dash: [] },
  institutional_part: { hue: 'ink', dash: [] },
  virtual: { hue: 'ink', dash: [] },
  successor: { hue: 'ink', dash: [2, 4] },
  appeal: { hue: 'court', dash: [8, 4] },
  judicial_review: { hue: 'court', dash: [8, 3, 2, 3] },
  supervision: { hue: 'oversight', dash: [5, 4] },
  sectoral_oversight: { hue: 'oversight', dash: [9, 3, 2, 3] },
  financial_audit: { hue: 'oversight', dash: [2, 3] },
  maladministration_review: { hue: 'oversight', dash: [13, 4] },
  political_accountability: { hue: 'political', dash: [10, 4, 2, 4] },
  reporting_accountability: { hue: 'political', dash: [10, 4, 2, 4] },
  co_legislation: { hue: 'political', dash: [2, 5] },
};
/** The thread from a place's authorities to its competent court. */
export const COURT_THREAD = { hue: 'court' as LineHue, dash: [2, 5] };

const lineText = (hue: LineHue) => hue === 'ink' ? NEUTRAL_TEXT
  : hue === 'political' ? HUES.eu.text : HUES[hue].text;

export const lineHex = (hue: LineHue, dark: boolean): string | null =>
  hue === 'ink' ? null
    : (hue === 'political' ? HUES.eu : HUES[hue])[dark ? 'dark' : 'light'];

export const nodeHex = (hue: NodeHue, dark: boolean): string | null =>
  hue === 'neutral' ? null : HUES[hue][dark ? 'dark' : 'light'];

/** Legend / outline mark for a node: same hue and shape as on the canvas. */
export const NodeMark: React.FC<{
  kind: string; virtual?: boolean; className?: string;
}> = ({ kind, virtual, className }) => {
  const shape = nodeShape(kind, virtual);
  const hue = nodeHue(kind, virtual);
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"
         className={`h-3.5 w-3.5 shrink-0 ${
           hue === 'neutral' ? NEUTRAL_TEXT : HUES[hue].text} ${className ?? ''}`}>
      {shape === 'ring' ? (
        <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor"
                strokeWidth="1.8" />
      ) : shape === 'diamond' ? (
        <rect x="2.6" y="2.6" width="8.8" height="8.8" rx="1"
              transform="rotate(45 7 7)" fill="currentColor" />
      ) : (
        <circle cx="7" cy="7" r="5" fill="currentColor" />
      )}
    </svg>
  );
};

/** Legend mark for a relation: the canvas stroke, dash pattern included. */
export const LineMark: React.FC<{
  hue: LineHue; dash: number[]; arrow?: boolean; bold?: boolean;
}> = ({ hue, dash, arrow = true, bold }) => (
  <svg viewBox="0 0 40 10" aria-hidden="true" focusable="false"
       className={`h-2.5 w-10 shrink-0 ${lineText(hue)}`}>
    <line x1="1" y1="5" x2={arrow ? 33 : 39} y2="5" stroke="currentColor"
          strokeWidth={bold ? 2 : 1.5}
          strokeDasharray={dash.length ? dash.join(' ') : undefined} />
    {arrow && <path d="M39 5 L32.5 1.8 L32.5 8.2 Z" fill="currentColor" />}
  </svg>
);
