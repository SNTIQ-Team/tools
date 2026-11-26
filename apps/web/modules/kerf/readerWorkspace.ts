export const MAX_READER_PANES = 4;
export const MAX_READER_TABS = 24;
const MAX_CLOSED_TABS = 64;
const HASH_PREFIX = '#reader=';
const MAX_HASH_LENGTH = 131_072;
const MAX_JSON_LENGTH = 32_768;

export type ReaderDocumentType = 'law' | 'decision';
export type ReaderView = 'read' | 'history' | 'diff' | 'versions';
export type ReaderTile = { paneId: string } | {
  axis: 'columns' | 'rows'; ratio: number; first: ReaderTile; second: ReaderTile;
};
export interface ReaderComparisonState { from: string; to: string; split: boolean; kind?: 'norm' }

export interface ReaderTab {
  id: string;
  actId: string;
  norm: string | null;
  documentType?: ReaderDocumentType;
  at?: string;
  view?: Exclude<ReaderView, 'read'>;
  pinned?: true;
  comparison?: ReaderComparisonState;
}

export interface ReaderPane {
  id: string;
  tabs: ReaderTab[];
  activeTabId: string | null;
}

export interface ReaderClosedTab {
  paneId: string;
  index: number;
  tab: ReaderTab;
}

export interface ReaderWorkspace {
  version: 1;
  panes: ReaderPane[];
  activePaneId: string;
  layout: 'columns' | 'rows';
  tiles?: ReaderTile;
  closedTabs?: ReaderClosedTab[];
}

export type ReaderWorkspaceAction =
  | { type: 'open'; actId: string; norm?: string | null; paneId?: string; mode: 'new' | 'replace'; documentType?: ReaderDocumentType; at?: string }
  | { type: 'activate'; paneId: string; tabId?: string }
  | { type: 'set-version'; paneId: string; tabId: string; at: string }
  | { type: 'close-tab'; paneId: string; tabId: string }
  | { type: 'close-pane'; paneId: string }
  | { type: 'reopen' }
  | { type: 'reorder-tab'; paneId: string; tabId: string; index: number }
  | { type: 'move-tab'; fromPaneId: string; toPaneId: string; tabId: string; index?: number }
  | { type: 'split'; paneId?: string; layout?: 'columns' | 'rows' }
  | { type: 'set-layout'; layout: 'columns' | 'rows' }
  | { type: 'resize-tile'; path: string; ratio: number }
  | { type: 'set-view'; paneId: string; tabId: string; view: ReaderView }
  | { type: 'set-comparison'; paneId: string; tabId: string; comparison: ReaderComparisonState }
  | { type: 'pin-tab'; paneId: string; tabId: string }
  | { type: 'close-others'; paneId: string; tabId: string };

export type ReaderAction = ReaderWorkspaceAction;

export function validReaderDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validComparison(value: unknown): value is ReaderComparisonState {
  if (exactObject(value, ['kind', 'from', 'to', 'split']) && value.kind === 'norm') {
    return typeof value.split === 'boolean' && validText(value.from, 512) && validText(value.to, 512);
  }
  return exactObject(value, ['from', 'to', 'split']) && typeof value.split === 'boolean'
    && (value.from === 'HEAD' || validReaderDate(value.from))
    && (value.to === 'HEAD' || validReaderDate(value.to));
}

export function createWorkspace(): ReaderWorkspace {
  return {
    version: 1,
    panes: [{ id: 'p1', tabs: [], activeTabId: null }],
    activePaneId: 'p1',
    layout: 'columns',
    closedTabs: [],
  };
}

export function readerDocKey(actId: string, norm: string | null = null, documentType: ReaderDocumentType = 'law', at?: string): string {
  return JSON.stringify(documentType === 'decision' ? [actId, norm, 'decision'] : at ? [actId, norm, at] : [actId, norm]);
}

function validText(value: unknown, limit: number): value is string {
  if (typeof value !== 'string' || !value || value.length > limit || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    encodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

function tabCount(state: ReaderWorkspace): number {
  return state.panes.reduce((sum, pane) => sum + pane.tabs.length, 0);
}

function nextId(state: ReaderWorkspace, prefix: 'p' | 't'): string {
  const used = new Set(prefix === 'p'
    ? [...state.panes.map((pane) => pane.id), ...(state.closedTabs ?? []).map((entry) => entry.paneId)]
    : [...state.panes.flatMap((pane) => pane.tabs.map((tab) => tab.id)), ...(state.closedTabs ?? []).map((entry) => entry.tab.id)]);
  let index = 1;
  while (used.has(`${prefix}${index}`)) index++;
  return `${prefix}${index}`;
}

function replacePane(state: ReaderWorkspace, pane: ReaderPane, activate = false): ReaderWorkspace {
  return {
    ...state,
    panes: state.panes.map((current) => current.id === pane.id ? pane : current),
    activePaneId: activate ? pane.id : state.activePaneId,
  };
}

export function workspaceTiles(state: ReaderWorkspace): ReaderTile {
  const chain = (panes: ReaderPane[]): ReaderTile => panes.length === 1 ? { paneId: panes[0].id }
    : { axis: state.layout, ratio: 1 / panes.length, first: { paneId: panes[0].id }, second: chain(panes.slice(1)) };
  return state.tiles ?? chain(state.panes);
}

function mapLeaf(tile: ReaderTile, paneId: string, replace: (leaf: ReaderTile) => ReaderTile): ReaderTile {
  if ('paneId' in tile) return tile.paneId === paneId ? replace(tile) : tile;
  return { ...tile, first: mapLeaf(tile.first, paneId, replace), second: mapLeaf(tile.second, paneId, replace) };
}

function removeLeaf(tile: ReaderTile, paneId: string): ReaderTile | null {
  if ('paneId' in tile) return tile.paneId === paneId ? null : tile;
  const first = removeLeaf(tile.first, paneId), second = removeLeaf(tile.second, paneId);
  return first && second ? { ...tile, first, second } : first ?? second;
}

function resizeTile(tile: ReaderTile, path: string, ratio: number): ReaderTile {
  if ('paneId' in tile) return tile;
  if (!path) return Math.abs(tile.ratio - ratio) < 0.001 ? tile : { ...tile, ratio };
  const key = path[0] === '0' ? 'first' : 'second';
  const child = resizeTile(tile[key], path.slice(1), ratio);
  return child === tile[key] ? tile : { ...tile, [key]: child };
}

function removeTab(pane: ReaderPane, index: number): ReaderPane {
  const tabs = pane.tabs.filter((_, current) => current !== index);
  return {
    ...pane,
    tabs,
    activeTabId: pane.activeTabId === pane.tabs[index].id
      ? (tabs[index] ?? tabs[index - 1])?.id ?? null
      : pane.activeTabId,
  };
}

function reorderTab(state: ReaderWorkspace, pane: ReaderPane, tabId: string, index: number): ReaderWorkspace {
  const from = pane.tabs.findIndex((tab) => tab.id === tabId);
  if (from < 0 || !Number.isInteger(index) || index < 0 || index > pane.tabs.length) return state;
  const to = Math.min(index, pane.tabs.length - 1);
  if (from === to) return state;
  const tabs = [...pane.tabs];
  const [tab] = tabs.splice(from, 1);
  tabs.splice(to, 0, tab);
  return replacePane(state, { ...pane, tabs });
}

// Invalid targets and capacity-limited operations are atomic no-ops.
export function workspaceReducer(state: ReaderWorkspace, action: ReaderWorkspaceAction): ReaderWorkspace {
  switch (action.type) {
    case 'open': {
      const pane = state.panes.find((item) => item.id === (action.paneId ?? state.activePaneId));
      if (!pane || typeof action.actId !== 'string'
        || (action.norm != null && typeof action.norm !== 'string')
        || (action.documentType !== undefined && action.documentType !== 'law' && action.documentType !== 'decision')
        || !['new', 'replace'].includes(action.mode)) return state;
      const actId = action.actId.trim();
      const norm = action.norm?.trim() || null;
      const documentType = action.documentType ?? 'law';
      if (!validText(actId, 256) || (norm !== null && !validText(norm, 128))
        || (documentType === 'decision' && (norm !== null || action.at !== undefined))
        || (action.at !== undefined && action.at !== 'HEAD' && !validReaderDate(action.at))) return state;
      const typed = documentType === 'decision' ? { documentType: 'decision' as const } : {};
      const current = pane.tabs.find((tab) => tab.id === pane.activeTabId);
      // Replacement within a law keeps its edition unless the caller explicitly
      // selects one. New tabs deduplicate by the complete document identity.
      const at = action.at === 'HEAD' ? undefined : action.at ?? (action.mode === 'replace'
        && current?.actId === actId && current.documentType !== 'decision' && documentType === 'law' ? current.at : undefined);
      const dated = at ? { at } : {};
      const existing = action.mode === 'new'
        ? pane.tabs.find((tab) => tab.actId === actId && tab.norm === norm && (tab.documentType ?? 'law') === documentType && tab.at === at)
        : current;
      if (existing) {
        if (existing.actId === actId && existing.norm === norm && (existing.documentType ?? 'law') === documentType
          && existing.at === at
          && pane.activeTabId === existing.id && state.activePaneId === pane.id) return state;
        return replacePane(state, {
          ...pane,
          tabs: action.mode === 'replace'
            ? pane.tabs.map((tab) => tab.id === existing.id ? { id: tab.id, actId, norm, ...typed, ...dated, ...(tab.pinned ? { pinned: true as const } : {}), ...(tab.actId === actId && tab.documentType !== 'decision' && documentType === 'law' ? { ...(tab.view ? { view: tab.view } : {}), ...(tab.comparison && (tab.comparison.kind !== 'norm' || tab.norm === norm && tab.at === at) ? { comparison: tab.comparison } : {}) } : {}) } : tab)
            : pane.tabs,
          activeTabId: existing.id,
        }, true);
      }
      if (tabCount(state) >= MAX_READER_TABS) return state;
      const tab = { id: nextId(state, 't'), actId, norm, ...typed, ...dated };
      return replacePane(state, { ...pane, tabs: [...pane.tabs, tab], activeTabId: tab.id }, true);
    }
    case 'set-version': {
      const pane = state.panes.find(item => item.id === action.paneId);
      const tab = pane?.tabs.find(item => item.id === action.tabId);
      if (!pane || !tab || tab.documentType === 'decision' || (action.at !== 'HEAD' && !validReaderDate(action.at))) return state;
      if ((tab.at ?? 'HEAD') === action.at) return state;
      const { at: previousDate, comparison, ...rest } = tab;
      const current = comparison && comparison.kind !== 'norm' ? { ...rest, comparison } : rest;
      const changed = action.at === 'HEAD' ? current : { ...current, at: action.at };
      return replacePane(state, { ...pane, tabs: pane.tabs.map(item => item.id === tab.id ? changed : item) });
    }
    case 'activate': {
      const pane = state.panes.find((item) => item.id === action.paneId);
      if (!pane || (action.tabId !== undefined && !pane.tabs.some((tab) => tab.id === action.tabId))) return state;
      const activeTabId = action.tabId ?? pane.activeTabId;
      if (state.activePaneId === pane.id && pane.activeTabId === activeTabId) return state;
      return replacePane(state, { ...pane, activeTabId }, true);
    }
    case 'set-comparison': {
      const pane = state.panes.find(item => item.id === action.paneId);
      const tab = pane?.tabs.find(item => item.id === action.tabId);
      if (!pane || !tab || tab.documentType === 'decision' || !validComparison(action.comparison)
        || (action.comparison.kind === 'norm' && !tab.norm)) return state;
      if (tab.comparison?.from === action.comparison.from && tab.comparison?.to === action.comparison.to
        && tab.comparison?.split === action.comparison.split && tab.comparison?.kind === action.comparison.kind) return state;
      return replacePane(state, { ...pane, tabs: pane.tabs.map(item => item.id === tab.id ? { ...item, comparison: { ...action.comparison } } : item) });
    }
    case 'set-view':
    case 'pin-tab': {
      const pane = state.panes.find(item => item.id === action.paneId);
      const tab = pane?.tabs.find(item => item.id === action.tabId);
      if (!pane || !tab) return state;
      let changed: ReaderTab;
      if (action.type === 'set-view') {
        if (tab.documentType === 'decision' || !['read', 'history', 'diff', 'versions'].includes(action.view)
          || (tab.view ?? 'read') === action.view) return state;
        const { view, ...rest } = tab;
        changed = action.view === 'read' ? rest : { ...rest, view: action.view };
      } else {
        const { pinned, ...rest } = tab;
        changed = pinned ? rest : { ...rest, pinned: true };
      }
      return replacePane(state, { ...pane, tabs: pane.tabs.map(item => item.id === tab.id ? changed : item) });
    }
    case 'close-others': {
      const pane = state.panes.find(item => item.id === action.paneId);
      if (!pane?.tabs.some(tab => tab.id === action.tabId)) return state;
      const removed = pane.tabs.flatMap((tab, index) => tab.id !== action.tabId && !tab.pinned ? [{ paneId: pane.id, index, tab }] : []);
      if (!removed.length) return state;
      return { ...replacePane(state, { ...pane, tabs: pane.tabs.filter(tab => tab.id === action.tabId || tab.pinned), activeTabId: action.tabId }),
        closedTabs: [...(state.closedTabs ?? []), ...removed].slice(-MAX_CLOSED_TABS) };
    }
    case 'close-tab': {
      const pane = state.panes.find((item) => item.id === action.paneId);
      const index = pane?.tabs.findIndex((tab) => tab.id === action.tabId) ?? -1;
      if (!pane || index < 0) return state;
      const closed = { paneId: pane.id, index, tab: pane.tabs[index] };
      return {
        ...replacePane(state, removeTab(pane, index)),
        closedTabs: [...(state.closedTabs ?? []), closed].slice(-MAX_CLOSED_TABS),
      };
    }
    case 'close-pane': {
      const index = state.panes.findIndex((pane) => pane.id === action.paneId);
      if (index < 0 || state.panes.length === 1) return state;
      const removed = state.panes[index];
      const neighbour = state.panes[index > 0 ? index - 1 : index + 1];
      const wasActive = state.activePaneId === removed.id;
      const merged = {
        ...neighbour,
        tabs: [...neighbour.tabs, ...removed.tabs],
        activeTabId: wasActive
          ? removed.activeTabId ?? neighbour.activeTabId
          : neighbour.activeTabId ?? removed.activeTabId,
      };
      return {
        ...state,
        panes: state.panes.filter((pane) => pane.id !== removed.id).map((pane) => pane.id === neighbour.id ? merged : pane),
        activePaneId: wasActive ? neighbour.id : state.activePaneId,
        ...(state.tiles ? { tiles: removeLeaf(state.tiles, removed.id)! } : {}),
      };
    }
    case 'reopen': {
      const history = state.closedTabs ?? [];
      const closed = history[history.length - 1];
      if (!closed || tabCount(state) >= MAX_READER_TABS) return state;
      const pane = state.panes.find((item) => item.id === closed.paneId)
        ?? state.panes.find((item) => item.id === state.activePaneId)!;
      if (state.panes.some((item) => item.tabs.some((tab) => tab.id === closed.tab.id))) return state;
      const tabs = [...pane.tabs];
      tabs.splice(Math.min(closed.index, tabs.length), 0, closed.tab);
      return {
        ...replacePane(state, { ...pane, tabs, activeTabId: closed.tab.id }, true),
        closedTabs: history.slice(0, -1),
      };
    }
    case 'reorder-tab': {
      const pane = state.panes.find((item) => item.id === action.paneId);
      return pane ? reorderTab(state, pane, action.tabId, action.index) : state;
    }
    case 'move-tab': {
      const from = state.panes.find((item) => item.id === action.fromPaneId);
      const to = state.panes.find((item) => item.id === action.toPaneId);
      const sourceIndex = from?.tabs.findIndex((tab) => tab.id === action.tabId) ?? -1;
      if (!from || !to || sourceIndex < 0) return state;
      if (from.id === to.id) return reorderTab(state, from, action.tabId, action.index ?? from.tabs.length - 1);
      const index = action.index ?? to.tabs.length;
      if (!Number.isInteger(index) || index < 0 || index > to.tabs.length) return state;
      const tab = from.tabs[sourceIndex];
      const tabs = [...to.tabs];
      tabs.splice(index, 0, tab);
      return replacePane(replacePane(state, removeTab(from, sourceIndex)), { ...to, tabs, activeTabId: tab.id }, true);
    }
    case 'split': {
      const index = state.panes.findIndex((pane) => pane.id === (action.paneId ?? state.activePaneId));
      if (index < 0 || state.panes.length >= MAX_READER_PANES
        || (action.layout !== undefined && action.layout !== 'rows' && action.layout !== 'columns')) return state;
      const source = state.panes[index];
      const active = source.tabs.find((tab) => tab.id === source.activeTabId);
      if (active && tabCount(state) >= MAX_READER_TABS) return state;
      const tab = active ? { ...active, id: nextId(state, 't') } : null;
      const pane: ReaderPane = { id: nextId(state, 'p'), tabs: tab ? [tab] : [], activeTabId: tab?.id ?? null };
      const panes = [...state.panes];
      panes.splice(index + 1, 0, pane);
      const axis = action.layout ?? state.layout;
      return { ...state, panes, activePaneId: pane.id, layout: axis,
        tiles: mapLeaf(workspaceTiles(state), source.id, first => ({ axis, ratio: 0.5, first, second: { paneId: pane.id } })) };
    }
    case 'set-layout': {
      if (action.layout !== 'columns' && action.layout !== 'rows') return state;
      if (action.layout === state.layout && !state.tiles) return state;
      const { tiles, ...rest } = state;
      return { ...rest, layout: action.layout };
    }
    case 'resize-tile': {
      if (!/^[01]{0,4}$/.test(action.path) || !Number.isFinite(action.ratio) || action.ratio < 0.15 || action.ratio > 0.85) return state;
      const before = workspaceTiles(state), tiles = resizeTile(before, action.path, action.ratio);
      return tiles === before ? state : { ...state, tiles };
    }
    default:
      return state;
  }
}

function exactObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function parseWorkspace(value: unknown): ReaderWorkspace | null {
  if ((!exactObject(value, ['version', 'panes', 'activePaneId', 'layout'])
      && !exactObject(value, ['version', 'panes', 'activePaneId', 'layout', 'tiles']))
    || value.version !== 1 || (value.layout !== 'columns' && value.layout !== 'rows')
    || !Array.isArray(value.panes) || !value.panes.length || value.panes.length > MAX_READER_PANES
    || typeof value.activePaneId !== 'string') return null;
  const paneIds = new Set<string>();
  const tabIds = new Set<string>();
  const panes: ReaderPane[] = [];
  for (const item of value.panes) {
    if (!exactObject(item, ['id', 'tabs', 'activeTabId']) || typeof item.id !== 'string'
      || !/^p[1-9]\d{0,8}$/.test(item.id) || paneIds.has(item.id)
      || !Array.isArray(item.tabs) || item.tabs.length > MAX_READER_TABS
      || (item.activeTabId !== null && typeof item.activeTabId !== 'string')) return null;
    paneIds.add(item.id);
    const tabs: ReaderTab[] = [];
    for (const tab of item.tabs) {
      if (!tab || !exactObject(tab, ['id', 'actId', 'norm', ...['documentType', 'at', 'view', 'pinned', 'comparison'].filter(key => Object.hasOwn(tab, key))]) || typeof tab.id !== 'string'
        || !/^t[1-9]\d{0,8}$/.test(tab.id) || tabIds.has(tab.id)
        || !validText(tab.actId, 256) || (tab.norm !== null && !validText(tab.norm, 128))
        || (Object.hasOwn(tab, 'documentType') && tab.documentType !== 'law' && tab.documentType !== 'decision')
        || (Object.hasOwn(tab, 'at') && !validReaderDate(tab.at))
        || (Object.hasOwn(tab, 'view') && tab.view !== 'history' && tab.view !== 'diff' && tab.view !== 'versions')
        || (Object.hasOwn(tab, 'pinned') && tab.pinned !== true)
        || (Object.hasOwn(tab, 'comparison') && (!validComparison(tab.comparison) || tab.comparison.kind === 'norm' && !tab.norm))
        || (tab.documentType === 'decision' && (tab.norm !== null || Object.hasOwn(tab, 'at') || Object.hasOwn(tab, 'view') || Object.hasOwn(tab, 'comparison')))) return null;
      tabIds.add(tab.id);
      if (tabIds.size > MAX_READER_TABS) return null;
      tabs.push({ id: tab.id, actId: tab.actId, norm: tab.norm as string | null,
        ...(tab.documentType === 'decision' ? { documentType: 'decision' as const } : {}),
        ...(typeof tab.at === 'string' ? { at: tab.at } : {}),
        ...(tab.view === 'history' || tab.view === 'diff' || tab.view === 'versions' ? { view: tab.view } : {}),
        ...(tab.pinned === true ? { pinned: true as const } : {}),
        ...(validComparison(tab.comparison) ? { comparison: { ...tab.comparison } } : {}),
      });
    }
    if (tabs.length ? !tabs.some((tab) => tab.id === item.activeTabId) : item.activeTabId !== null) return null;
    panes.push({ id: item.id, tabs, activeTabId: item.activeTabId as string | null });
  }
  if (!paneIds.has(value.activePaneId)) return null;
  let tiles: ReaderTile | undefined;
  if (Object.hasOwn(value, 'tiles')) {
    const remaining = new Set(paneIds);
    const parseTile = (tile: unknown, depth = 0): ReaderTile | null => {
      if (depth >= MAX_READER_PANES) return null;
      if (exactObject(tile, ['paneId']) && typeof tile.paneId === 'string' && remaining.delete(tile.paneId)) return { paneId: tile.paneId };
      if (!exactObject(tile, ['axis', 'ratio', 'first', 'second']) || !['columns', 'rows'].includes(tile.axis as string)
        || typeof tile.ratio !== 'number' || !Number.isFinite(tile.ratio) || tile.ratio < 0.15 || tile.ratio > 0.85) return null;
      const first = parseTile(tile.first, depth + 1), second = parseTile(tile.second, depth + 1);
      return first && second ? { axis: tile.axis as 'columns' | 'rows', ratio: tile.ratio, first, second } : null;
    };
    tiles = parseTile(value.tiles) ?? undefined;
    if (!tiles || remaining.size) return null;
  }
  return { version: 1, panes, activePaneId: value.activePaneId, layout: value.layout, ...(tiles ? { tiles } : {}), closedTabs: [] };
}

export function encodeWorkspace(state: ReaderWorkspace): string {
  const parsed = parseWorkspace({ version: state.version, panes: state.panes, activePaneId: state.activePaneId, layout: state.layout, ...(state.tiles ? { tiles: state.tiles } : {}) });
  if (!parsed) throw new Error('Invalid reader workspace');
  const json = JSON.stringify({ version: parsed.version, panes: parsed.panes, activePaneId: parsed.activePaneId, layout: parsed.layout, ...(parsed.tiles ? { tiles: parsed.tiles } : {}) });
  const hash = HASH_PREFIX + encodeURIComponent(json);
  if (json.length > MAX_JSON_LENGTH || hash.length > MAX_HASH_LENGTH) throw new Error('Reader workspace is too large');
  return hash;
}

export function decodeWorkspace(hash: string): ReaderWorkspace | null {
  if (typeof hash !== 'string' || hash.length > MAX_HASH_LENGTH || !hash.startsWith(HASH_PREFIX)) return null;
  try {
    const json = decodeURIComponent(hash.slice(HASH_PREFIX.length));
    if (json.length > MAX_JSON_LENGTH) return null;
    return parseWorkspace(JSON.parse(json));
  } catch {
    return null;
  }
}
