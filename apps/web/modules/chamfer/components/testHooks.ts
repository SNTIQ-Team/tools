// Lightweight hook host for component event/state regression tests without a DOM.
// Browser layout is verified separately; only external i18n/React scheduling is stubbed.
import './cssStub';
import React from 'react';
import Module from 'node:module';
import { createRequire } from 'node:module';
const localRequire = createRequire(import.meta.url);
export function hookHost(context?: () => unknown) {
  const slots: any[] = []; let index = 0; let pending: (() => void)[] = [];
  const memo = (fn: () => unknown, deps?: unknown[]) => {
    const slot = index++; const previous = slots[slot];
    if (deps && previous?.deps && deps.length === previous.deps.length
      && deps.every((value, i) => Object.is(value, previous.deps[i]))) return previous.value;
    const value = fn(); slots[slot] = { deps, value }; return value;
  };
  function effect(fn: () => any, deps: unknown[]) {
    const slot = index++; const prev = slots[slot];
    if (!prev || deps.some((value, i) => !Object.is(value, prev.deps[i]))) {
      pending.push(() => { prev?.cleanup?.(); const cleanup = fn(); slots[slot] = { deps, cleanup }; });
    }
  }
  const hooks = { ...React,
    useState(initial: any) { const slot = index++; if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], (value: any) => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }]; },
    useRef(initial: any) { const slot = index++; return slots[slot] ?? (slots[slot] = { current: initial }); },
    useMemo(fn: () => unknown, deps?: unknown[]) { return memo(fn, deps); },
    useCallback(fn: unknown, deps?: unknown[]) { return memo(() => fn, deps); },
    useContext() { return context?.(); },
    useEffect: effect,
    // No layout in Node: a layout effect runs like an ordinary one here.
    useLayoutEffect: effect,
  };
  return {
    load<T>(file: string): T {
      const original = (Module as any)._load;
      (Module as any)._load = function(id: string, ...args: unknown[]) {
        if (id === 'react') return hooks;
        if (id === 'react-i18next') return { useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) };
        return original.call(this, id, ...args);
      };
      try { delete localRequire.cache[localRequire.resolve(file)]; return localRequire(file); }
      finally { (Module as any)._load = original; }
    },
    render<T>(fn: () => T): T { index = 0; return fn(); },
    effects() { const current = pending; pending = []; current.forEach(run => run()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
export function nodes(node: any, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach(child => nodes(child, out)); return out; }
  out.push(node); nodes(node.props?.children, out); return out;
}
export const button = (tree: unknown, key: string) => nodes(tree).find(node => node.type === 'button' && nodes(node).some(child => child.props?.children === key));
