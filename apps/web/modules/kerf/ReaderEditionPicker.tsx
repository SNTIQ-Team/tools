'use client';

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Clock3, History } from 'lucide-react';
import { readerEditionChoices, readerEditionCopy, readerEditionDate, readerHistoryEvents } from './readerEditions';
import { readerWorkbenchCopy } from './readerWorkbenchCopy';
import type { KerfActArchive } from './client';
import styles from './editionPicker.module.css';

export default function ReaderEditionPicker({ value, archive, language, label, onChange, onHistory }: {
  value: string; archive: KerfActArchive | null; language: string; label: string; onChange: (value: string) => void; onHistory?: (id?: string) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const copy = readerEditionCopy(language);
  const choices = readerEditionChoices(archive, language);
  const workbench = readerWorkbenchCopy(language);
  const events = readerHistoryEvents(archive);
  if (!choices.some(item => item.value === value)) choices.push({ value, label: readerEditionDate(value, language), detail: copy.unknown, group: 'observed', future: false, available: value <= (archive?.head_date || new Date().toISOString().slice(0, 10)) });
  const index = choices.findIndex(item => item.value === value);
  const current = choices[index];
  const close = (focus = false) => { setOpen(false); if (focus) trigger.current?.focus(); };

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 18;
    const above = below < 180 && rect.top > below;
    setPosition({ position: 'fixed', width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      maxHeight: Math.min(400, above ? rect.top - 18 : below) });
    const focusable = menu.current?.querySelector<HTMLElement>('[aria-selected="true"]:not(:disabled)')
      ?? menu.current?.querySelector<HTMLElement>('[role="option"]:not(:disabled),button:not(:disabled)');
    focusable?.focus({ preventScroll: true });
    const selected = menu.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (selected && menu.current) menu.current.scrollTop = Math.max(0, selected.offsetTop - 60);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    const resize = () => setOpen(false);
    const scroll = (event: Event) => { if (event.target !== menu.current && !menu.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); window.removeEventListener('scroll', scroll, true); };
  }, [open]);

  return <>
    <button ref={trigger} type="button" className={styles.trigger} role="combobox" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(!open)} onKeyDown={event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); } else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); } }}>
      <span><small>{value === 'HEAD' ? label : current.group === 'observed' ? copy.observed : copy.legal}</small><strong>{current.label}</strong></span>
      {current.future && <Clock3 size={14} />}<ChevronDown size={14} className={styles.chevron} />
    </button>
    {open && createPortal(<div ref={menu} id={id} role="dialog" aria-label={label} className={styles.menu} style={position}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) close(); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
        const options = Array.from(menu.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
        const focused = options.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowDown' ? (focused + 1) % options.length : event.key === 'ArrowUp' ? (focused - 1 + options.length) % options.length : -1;
        if (next >= 0) { event.preventDefault(); options[next]?.focus(); }
      }}>
      {onHistory && <button className={styles.option} onClick={() => { close(); onHistory(); }}><History size={16} /><span><strong>{workbench.allHistory} · {events.length}</strong>{events.length > 0 && <small>{readerEditionDate(events[events.length - 1].published_at ?? events[events.length - 1].date, language)} – {readerEditionDate(events[0].published_at ?? events[0].date, language)}</small>}</span></button>}
      <div role="listbox" aria-label={label}>{choices.map((item, i) => <React.Fragment key={`${item.group}:${item.value}`}>
        {item.group !== 'latest' && choices[i - 1]?.group !== item.group && <div role="presentation" className={styles.group}>{copy[item.group]}</div>}
        <button type="button" role="option" disabled={!item.available} aria-selected={value === item.value} tabIndex={-1} data-edition-value={item.value} data-future={item.future} className={styles.option} onClick={() => { onChange(item.value); close(true); }}>
          <span><strong>{item.label}</strong><small>{item.detail}</small>{!item.available && <small>{workbench.noBody}</small>}</span>{value === item.value ? <Check size={16} /> : item.future ? <Clock3 size={16} /> : null}
        </button>
      </React.Fragment>)}</div>
      {onHistory && events.length > 0 && <><div className={styles.group}>{workbench.changes}</div>{events.map((event, index) => <button className={styles.option} key={event.id ?? event.event_id ?? index} data-edition-event={event.published_at ?? event.date} onClick={() => { close(); onHistory(event.id ?? event.event_id ?? undefined); }}><span><strong>{readerEditionDate(event.published_at ?? event.date, language)}</strong><small>{event.procedure_title ?? event.article_heading}</small>{!event.historical_text_reconstructed && <small>{workbench.noBody}</small>}</span></button>)}</>}
    </div>, document.body)}
  </>;
}
