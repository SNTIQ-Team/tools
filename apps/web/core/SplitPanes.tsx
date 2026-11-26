'use client';

import React, { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { Group, Panel, Separator, useGroupRef, usePanelRef } from 'react-resizable-panels';
import { storageGet, storageRemove, storageSet } from './safeStorage';

type SplitMode = 'split' | 'first' | 'second' | 'stack';

type SplitPanesProps = {
  id: string;
  label: string;
  first: React.ReactNode;
  second: React.ReactNode;
  /** Numbers are pixels. Percentages include the unit, e.g. "50%". */
  defaultSize: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  secondMinSize?: number | string;
  orientation?: 'horizontal' | 'vertical';
  /** Keep both children mounted when a view shows a single pane or stacks them. */
  mode?: SplitMode;
  className?: string;
  firstClassName?: string;
  secondClassName?: string;
};

// A fresh browser's first render must match the server, including panel
// inline styles. React reads the device preference after hydration.
const serverPreference = () => null;
const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify);
  return () => window.removeEventListener('storage', notify);
};

const hitArea = { fine: 10, coarse: 44 };

export default function SplitPanes({
  id, label, first, second, defaultSize, minSize, maxSize, secondMinSize = '20%',
  orientation = 'horizontal', mode = 'split',
  className = '', firstClassName, secondClassName,
}: SplitPanesProps) {
  const group = useGroupRef();
  const firstPanel = usePanelRef();
  const groupId = `sntiq-split:${id}:${orientation}`;
  const interactive = mode === 'split';
  const firstId = `${groupId}-a`;
  const secondId = `${groupId}-b`;
  const readSize = useCallback(() => storageGet(groupId), [groupId]);
  const saved = useSyncExternalStore(subscribe, readSize, serverPreference);
  const defaultLayout = useMemo(() => {
    const size = Number(saved);
    if (saved && Number.isFinite(size) && size > 0 && size < 100) {
      return { [firstId]: size, [secondId]: 100 - size };
    }
  }, [saved, firstId, secondId]);

  // The library caches the layout it measured while a single pane was
  // visible. Apply the preference once the two-pane workspace has a size.
  useLayoutEffect(() => {
    if (interactive && defaultLayout) group.current?.setLayout(defaultLayout);
  }, [defaultLayout, group, interactive]);

  function reset() {
    firstPanel.current?.resize(defaultSize);
    storageRemove(groupId);
  }

  return (
    <Group id={groupId} groupRef={group} data-split={id} data-split-mode={mode}
      orientation={orientation} disabled={!interactive} resizeTargetMinimumSize={hitArea}
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout, meta) => {
        if (interactive && meta.isUserInteraction) storageSet(groupId, String(layout[firstId]));
      }}
      className={`sntiq-split ${className}`}>
      <Panel id={firstId} data-split-pane="first" panelRef={firstPanel} className={firstClassName}
        defaultSize={defaultSize} minSize={minSize} maxSize={maxSize}>{first}</Panel>
      {interactive && <Separator className="sntiq-split-handle" data-orientation={orientation} aria-label={label}
        title={label} disableDoubleClick onDoubleClick={reset} />}
      <Panel id={secondId} data-split-pane="second" className={secondClassName} minSize={secondMinSize}>{second}</Panel>
    </Group>
  );
}
