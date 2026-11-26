type Key = { key: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; isComposing?: boolean; repeat?: boolean };
export type ReaderCommand = 'search' | 'search-book' | 'sidebar' | 'split-right' | 'split-down' | 'next-tab' | 'previous-tab' | 'next-pane' | 'previous-pane' | 'close' | 'reopen' | 'history' | 'diff' | 'versions' | 'read' | 'maximize';

export function readerShortcut(event: Key, editable: boolean): ReaderCommand | null {
  if (event.isComposing || event.repeat) return null;
  // Letters by physical key: with Option on macOS, or on a Cyrillic layout,
  // event.key is another character and the shortcut would never match.
  const letter = /^Key([A-Z])$/.exec(event.code ?? '');
  const key = letter ? letter[1].toLowerCase() : event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === 'k') return 'search';
  if (editable || event.ctrlKey || event.metaKey || !event.altKey) return null;
  if (key === 'pageup') return event.shiftKey ? 'previous-pane' : 'previous-tab';
  if (key === 'pagedown') return event.shiftKey ? 'next-pane' : 'next-tab';
  if (!event.shiftKey) return null;
  const commands: Record<string, ReaderCommand> = { arrowright: 'split-right', arrowdown: 'split-down', w: 'close', t: 'reopen', h: 'history', d: 'diff', v: 'versions', r: 'read', enter: 'maximize', f: 'search-book', b: 'sidebar' };
  return Object.hasOwn(commands, key) ? commands[key] : null;
}
