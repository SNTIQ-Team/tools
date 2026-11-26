'use client';
import React, { useEffect } from 'react';
import { Group, Panel, Separator, useGroupRef } from 'react-resizable-panels';
import { workspaceTiles, type ReaderTile, type ReaderWorkspace } from './readerWorkspace';
import styles from './readerWorkbench.module.css';

const tileKey = (tile: ReaderTile): string => 'paneId' in tile ? tile.paneId : `${tile.axis}(${tileKey(tile.first)},${tileKey(tile.second)})`;

function Split({ tile, path, render, onResize, label }: {
  tile: Exclude<ReaderTile, { paneId: string }>; path: string; render: (id: string) => React.ReactNode;
  onResize: (path: string, ratio: number) => void; label: string;
}) {
  const group = useGroupRef();
  const first = `${path || 'root'}-a`, second = `${path || 'root'}-b`;
  useEffect(() => { group.current?.setLayout({ [first]: tile.ratio * 100, [second]: (1 - tile.ratio) * 100 }); }, [tile.ratio, first, second, group]);
  return <Group groupRef={group} className={styles.tileGroup} orientation={tile.axis === 'columns' ? 'horizontal' : 'vertical'}
    onLayoutChanged={(layout, meta) => { if (meta.isUserInteraction) onResize(path, Math.round(layout[first] * 10) / 1000); }}>
    <Panel id={first} minSize="15%" maxSize="85%" defaultSize={`${tile.ratio * 100}%`}><Tile tile={tile.first} path={`${path}0`} render={render} onResize={onResize} label={label} /></Panel>
    {/* The site's split handle (core/SplitPanes, globals.css); a double-click
        shares the space evenly again. */}
    <Separator disableDoubleClick className="sntiq-split-handle" data-orientation={tile.axis === 'columns' ? 'horizontal' : 'vertical'} aria-label={label} title={label} onDoubleClick={() => onResize(path, 0.5)} />
    <Panel id={second} minSize="15%" defaultSize={`${(1 - tile.ratio) * 100}%`}><Tile tile={tile.second} path={`${path}1`} render={render} onResize={onResize} label={label} /></Panel>
  </Group>;
}

function Tile(props: { tile: ReaderTile; path: string; render: (id: string) => React.ReactNode; onResize: (path: string, ratio: number) => void; label: string }) {
  return 'paneId' in props.tile ? props.render(props.tile.paneId) : <Split key={tileKey(props.tile)} {...props} tile={props.tile} />;
}

export default function ReaderTiles({ workspace, single, render, onResize, label }: {
  workspace: ReaderWorkspace; single: boolean; render: (id: string) => React.ReactNode;
  onResize: (path: string, ratio: number) => void; label: string;
}) {
  const tiles = workspaceTiles(workspace);
  return <div className={styles.tiles} data-reader-tiles data-single={single}>
    {'paneId' in tiles ? render(tiles.paneId) : single ? render(workspace.activePaneId)
      : <Tile tile={tiles} path="" render={render} onResize={onResize} label={label} />}
  </div>;
}
