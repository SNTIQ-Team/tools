'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './readerWorkbench.module.css';

export default function ReaderContextMenu({ x, y, label, items, onClose }: {
  x: number; y: number; label: string; items: { label: string; icon: React.ReactNode; action: () => void; disabled?: boolean }[]; onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    const rect = menu.current!.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) });
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [x, y]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', onClose);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', onClose); };
  }, [onClose]);
  return createPortal(<div ref={menu} className={styles.contextMenu} role="menu" aria-label={label} style={position} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); onClose(); previousFocus.current?.focus(); return; }
    const buttons = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
  }}>{items.map((item, index) => <button key={index} type="button" role="menuitem" tabIndex={-1} disabled={item.disabled} onClick={() => { onClose(); item.action(); }}>{item.icon}<span>{item.label}</span></button>)}</div>, document.body);
}
