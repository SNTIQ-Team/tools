export type ReaderNode = { type: 'text'; text: string } | { type: 'element'; tag: string; children: ReaderNode[]; attrs?: { colspan?: number; rowspan?: number; role?: 'sentence' | 'footnote'; src?: string; alt?: string; width?: number; height?: number } };
export const readerInlineTags = new Set(['sup', 'sub', 'strong', 'em', 'u', 's', 'br', 'img', 'source-file']);
export const officialReaderAsset = (value: unknown) => typeof value === 'string' && /^https:\/\/www\.gesetze-im-internet\.de\/normengrafiken\/bgbl[12]_\d{4}\/[A-Za-z0-9_-]+\.(?:jpg|png|gif|pdf)$/iu.test(value) && !value.includes('..');
export function validateReaderBlocks(value: unknown, sourceText: string): ReaderNode[] | null {
  if (!Array.isArray(value)) return null;
  const tags = new Set(['p', 'div', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'caption', 'small', 'pre', ...readerInlineTags]);
  const text: string[] = [];
  let count = 0;
  let length = 0;
  const visit = (node: unknown, depth: number): boolean => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 64 || ++count > 50_000) return false;
    const row = node as Record<string, unknown>;
    if (row.type === 'text') {
      if (typeof row.text !== 'string' || Object.keys(row).some(key => key !== 'type' && key !== 'text')) return false;
      length += row.text.length;
      if (length > 4_000_000) return false;
      text.push(row.text);
      return true;
    }
    if (row.type !== 'element' || typeof row.tag !== 'string' || !tags.has(row.tag) || !Array.isArray(row.children)) return false;
    if (Object.keys(row).some(key => !['type', 'tag', 'children', 'attrs'].includes(key))) return false;
    if ((row.tag === 'br' || row.tag === 'img') && row.children.length) return false;
    if (row.attrs !== undefined) {
      if (!row.attrs || typeof row.attrs !== 'object' || Array.isArray(row.attrs)) return false;
      if (['img', 'source-file'].includes(row.tag) && !officialReaderAsset((row.attrs as Record<string, unknown>).src)) return false;
      if (Object.entries(row.attrs).some(([key, value]) => {
        if (['img', 'source-file'].includes(String(row.tag))) {
          if (key === 'src') return !officialReaderAsset(value) || (row.tag === 'img' ? /\.pdf$/iu.test(String(value)) : !/\.pdf$/iu.test(String(value)));
          if (key === 'alt' && row.tag === 'img') return typeof value !== 'string' || value.length > 4096;
          if (['width', 'height'].includes(key) && row.tag === 'img') return !Number.isInteger(value) || Number(value) < 1 || Number(value) > 10000;
          return true;
        }
        if (key === 'role') return !(row.tag === 'sup' && (value === 'sentence' || value === 'footnote') || row.tag === 'small' && value === 'footnote');
        return !['colspan', 'rowspan'].includes(key) || !['td', 'th'].includes(String(row.tag)) || !Number.isInteger(value) || Number(value) < 1 || Number(value) > 1000;
      })) return false;
    }
    if (['img', 'source-file'].includes(row.tag) && row.attrs === undefined) return false;
    return row.children.every(child => visit(child, depth + 1));
  };
  if (!value.every(node => visit(node, 0))) return null;
  const normalize = (text: string) => text.replace(/[ \t]+/g, ' ').trim();
  return normalize(text.join('')) === normalize(sourceText) ? value as ReaderNode[] : null;
}


export type ReaderSourceAnnotations = {
  source_annotations: ReaderNode[];
  source_annotations_text: string;
  source_annotations_sha256: string;
};

/** Official notes are a separately bounded source, never part of the body hash. */
export function validateReaderSourceAnnotations(value: Record<string, unknown>): ReaderSourceAnnotations | null {
  const text = value.source_annotations_text;
  const hash = value.source_annotations_sha256;
  if (typeof text !== 'string' || text.length > 4_000_000 || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) return null;
  const blocks = validateReaderBlocks(value.source_annotations, text);
  if (!blocks) return null;
  const flatten = (nodes: ReaderNode[]): string => nodes.map(node => node.type === 'text' ? node.text : flatten(node.children)).join('');
  if (flatten(blocks) !== text) return null;
  return { source_annotations: blocks, source_annotations_text: text, source_annotations_sha256: hash };
}
