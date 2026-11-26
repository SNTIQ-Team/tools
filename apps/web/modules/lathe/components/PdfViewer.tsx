'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import pdfjsPackage from 'pdfjs-dist/package.json';
import { ChevronLeft, ChevronRight, TriangleAlert, Minus, Plus } from 'lucide-react';
import { useForm } from './FormContext';
import { buildZp1aOperations } from '../engine/mapping';
import { previewValues, previewWarnings, type Widget } from '../engine/previewState';
import { PreviewQueue, type PreviewHandle } from './previewLifecycle';
import '../i18n/register';

const PDF_URL = '/dt/lathe/forms/zp1a.pdf';
const FONT_URL = '/fonts/NotoSans-Regular.ttf';

type PdfJs = typeof import('pdfjs-dist');
type PdfDoc = Awaited<ReturnType<PdfJs['getDocument']>['promise']>;
type Template = { lib: PdfJs; pdf: PdfDoc };

/** The widgets (form fields) on one page, as previewState needs them. */
async function pageWidgets(pdf: PdfDoc, pageNo: number): Promise<Widget[]> {
  const page = await pdf.getPage(pageNo);
  const out: Widget[] = [];
  for (const a of await page.getAnnotations()) {
    if (a.subtype !== 'Widget' || !a.fieldName) continue;
    if (a.fieldType === 'Tx') out.push({ id: a.id, field: a.fieldName, kind: 'text' });
    else if (a.fieldType === 'Btn' && a.checkBox) out.push({ id: a.id, field: a.fieldName, kind: 'checkbox' });
  }
  return out;
}

/**
 * Live preview of the filled ZP 1a. The blank form is opened in pdf.js ONCE
 * (one worker, one parse); each change only writes the answers into pdf.js's
 * annotation storage and redraws the visible page (engine/previewState.ts).
 * The downloadable PDF is still built by pdf-lib with the embedded font
 * (Questionnaire → fill.ts); the preview shows the same fields and values.
 */
/** `followPage`: the page the current step fills (previewPage.ts); the preview
    turns to it when the step changes, and the person can still page by hand. */
const PdfViewer: React.FC<{ followPage?: number | null; followKey?: string }> = ({ followPage = null, followKey }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewQueue = useRef<PreviewQueue | null>(null);
  if (!previewQueue.current) previewQueue.current = new PreviewQueue();
  const widgetCache = useRef(new Map<number, Promise<Widget[]>>());
  const { data } = useForm();
  const { t } = useTranslation('lathe');
  const [template, setTemplate] = useState<Template | null>(null);
  const [allWidgets, setAllWidgets] = useState<Widget[] | null>(null);
  const [hasGlyph, setHasGlyph] = useState<((cp: number) => boolean) | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scaleMultiplier, setScaleMultiplier] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(0);
  // A4 until the first page has been measured: keeps the sheet from jumping
  const [pageRatio, setPageRatio] = useState(210 / 297);
  // Until the first page is drawn the sheet stays hidden behind the spinner:
  // an empty white page would flash on the dark theme.
  const [painted, setPainted] = useState(false);
  const isLoading = (!template || !painted) && !loadError;

  // Keyed by the step: moving between two steps of the same page still
  // brings back that page after the person paged away by hand.
  useEffect(() => {
    if (followPage) setPageNumber(followPage);
  }, [followPage, followKey]);

  // Open the blank form once: pdf.js and the template load in parallel.
  useEffect(() => {
    let alive = true;
    let task: { destroy(): Promise<void> } | null = null;
    const abort = new AbortController();
    const cache = widgetCache.current;
    (async () => {
      try {
        const [lib, bytes] = await Promise.all([
          import(/* webpackIgnore: true */ `/pdfjs/${pdfjsPackage.version}/pdf.min.mjs`) as Promise<PdfJs>,
          fetch(PDF_URL, { signal: abort.signal }).then((r) => {
            if (!r.ok) throw new Error(`PDF_FETCH_${r.status}`);
            return r.arrayBuffer();
          }),
        ]);
        lib.GlobalWorkerOptions.workerSrc = `/pdfjs/${lib.version}/pdf.worker.min.mjs`;
        const loading = lib.getDocument({ data: new Uint8Array(bytes) });
        task = loading;
        const pdf = await loading.promise;
        if (!alive) return;
        setNumPages(pdf.numPages);
        setTemplate({ lib, pdf });
      } catch (e: any) {
        if (!alive) return;
        console.error(`[SNTIQ:LATHE] Template load failed. Code: ${e?.message ?? 'ERR-TPL'}`);
        setLoadError(true);
      }
    })();
    return () => {
      alive = false;
      abort.abort();
      cache.clear();
      if (task) void task.destroy().catch(() => {});
    };
  }, []);

  const widgetsOn = (pdf: PdfDoc, pageNo: number) => {
    let cached = widgetCache.current.get(pageNo);
    if (!cached) {
      cached = pageWidgets(pdf, pageNo);
      widgetCache.current.set(pageNo, cached);
    }
    return cached;
  };

  // After the first page: every page's fields (for the warnings) and the
  // download font's coverage (characters it cannot print), off the critical path.
  useEffect(() => {
    if (!template) return;
    let alive = true;
    const { pdf } = template;
    void Promise.all(Array.from({ length: pdf.numPages }, (_, i) => widgetsOn(pdf, i + 1)))
      .then((pages) => { if (alive) setAllWidgets(pages.flat()); })
      .catch(() => {});
    void (async () => {
      try {
        const [{ default: fontkit }, res] = await Promise.all([import('@pdf-lib/fontkit'), fetch(FONT_URL)]);
        if (!res.ok) return;
        const font = fontkit.create(new Uint8Array(await res.arrayBuffer()));
        if (alive) setHasGlyph(() => (cp: number) => font.hasGlyphForCodePoint(cp));
      } catch { /* coverage is best-effort, as in fill.ts */ }
    })();
    return () => { alive = false; };
  }, [template]);

  const operations = useMemo(() => buildZp1aOperations(data), [data]);
  const fillWarnings = useMemo(
    () => (allWidgets ? previewWarnings(operations, allWidgets, hasGlyph) : []),
    [operations, allWidgets, hasGlyph],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth((prev) =>
            Math.abs(prev - entry.contentRect.width) > 25 ? entry.contentRect.width : prev
          );
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Redraw the visible page with the current answers.
  const firstPaint = useRef(true);
  const lastOperations = useRef<unknown>(null);
  useEffect(() => {
    if (!template || !canvasRef.current) return;
    const { lib, pdf } = template;
    let handle: PreviewHandle | undefined;

    const render = () => {
      handle = previewQueue.current!.start(async job => {
        const pageNo = Math.min(pageNumber, pdf.numPages);
        const widgets = await job.wait(widgetsOn(pdf, pageNo));
        if (job.cancelled) return;
        for (const [id, value] of previewValues(operations, widgets)) pdf.annotationStorage.setValue(id, value);

        const page = await job.wait(pdf.getPage(pageNo));
        if (job.cancelled) return;

        // The sheet's on-screen size is pure CSS (see .paper: a share of the
        // canvas area's width); here only the pixel buffer is sized, at the
        // device's pixel ratio so the form stays legible on phones. The
        // buffer is capped: 5x zoom on a wide retina pane would otherwise
        // ask for a canvas larger than mobile browsers allocate (~16.7M px).
        const widthToUse = containerWidth || containerRef.current?.clientWidth || 600;
        const cssWidth = canvasRef.current?.clientWidth || Math.max(widthToUse - 34, 240) * scaleMultiplier;
        const unscaled = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const targetWidth = Math.min(cssWidth * dpr, 3200);
        const viewport = page.getViewport({ scale: targetWidth / unscaled.width });
        setPageRatio(unscaled.width / unscaled.height);

        const canvas = canvasRef.current;
        if (!canvas || job.cancelled) return;
        // Render off-screen and swap the finished page in: resizing the
        // visible canvas first would blank the sheet on every keystroke.
        const buffer = document.createElement('canvas');
        buffer.width = Math.floor(viewport.width);
        buffer.height = Math.floor(viewport.height);
        const context = buffer.getContext('2d');
        if (context) {
          const rendering = page.render({
            canvas: buffer,
            canvasContext: context,
            viewport,
            annotationMode: lib.AnnotationMode.ENABLE_STORAGE,
          });
          job.trackRender(rendering);
          await job.wait(rendering.promise);
          if (job.cancelled) return;
          canvas.width = buffer.width;
          canvas.height = buffer.height;
          canvas.getContext('2d')?.drawImage(buffer, 0, 0);
          setPainted(true);
        }
        buffer.width = 0;
        buffer.height = 0;
      });
      const current = handle;
      void current.settled.catch((e: unknown) => {
        if (!current.cancelled)
          console.error(`[SNTIQ:LATHE] Preview render failed. Code: ${e instanceof Error ? e.name : 'ERR-RENDER'}`);
      });
    };

    // The first page draws at once; later changes wait for a pause in typing.
    // Typing waits for a pause; turning a page or zooming redraws at once.
    const typed = lastOperations.current !== operations;
    lastOperations.current = operations;
    const timer = setTimeout(render, firstPaint.current || !typed ? 0 : 120);
    firstPaint.current = false;
    return () => {
      clearTimeout(timer);
      handle?.cancel();
    };
  }, [template, operations, pageNumber, scaleMultiplier, containerWidth]);

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      {/* Tools: a line above the document, no bar */}
      <div className="lathe-paneHead">
        <h2 className="sntiq-kicker lathe-toolTitle">{t('nav.preview')}</h2>

        <div className="lathe-toolGroup">
          <button
            type="button"
            disabled={scaleMultiplier <= 0.6}
            onClick={() => setScaleMultiplier((p) => Math.max(p - 0.2, 0.6))}
            className="lathe-icon"
            aria-label={t('nav.zoom_out')}
            title={t('nav.zoom_out')}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={scaleMultiplier >= 5}
            onClick={() => setScaleMultiplier((p) => Math.min(p + 0.2, 5))}
            className="lathe-icon"
            aria-label={t('nav.zoom_in')}
            title={t('nav.zoom_in')}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>

        <div className="lathe-toolGroup">
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => p - 1)}
            className="lathe-icon"
            aria-label={t('nav.prev_page')}
            title={t('nav.prev_page')}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span className="lathe-pageNo">
            {pageNumber} / {numPages || '–'}
          </span>
          <button
            type="button"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => p + 1)}
            className="lathe-icon"
            aria-label={t('nav.next_page')}
            title={t('nav.next_page')}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Live fill warnings — details are shown at download time in the
          Questionnaire panel; here a compact, always-visible notice */}
      {fillWarnings.length > 0 && (
        <div role="alert" className="lathe-status lathe-previewNote" data-tone="bad">
          <TriangleAlert aria-hidden="true" />
          <div className="min-w-0">
            <p><strong>{t('warning.fill.title')}</strong></p>
            <p className="text-[0.8125rem] text-muted break-words">
              {fillWarnings.map((w) => w.replace(/^UNSUPPORTED_CHARS:/, '')).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Canvas area */}
      <div ref={containerRef} className="lathe-canvasArea">
        {loadError ? (
          <div className="lathe-placeholder" role="alert">{t('error.tpl_load')}</div>
        ) : isLoading && (
          <div className="lathe-placeholder" role="status">
            <div className="lathe-spinner" aria-hidden="true"></div>
            <span>{t('nav.loading')}</span>
          </div>
        )}
        {/* In the DOM as soon as the form is open (the first draw needs the
            canvas), shown only once a page is on it. */}
        {template && !loadError && (
          <div className="lathe-paper" hidden={!painted} style={{ width: `${scaleMultiplier * 100}%` }}>
            <canvas ref={canvasRef} style={{ aspectRatio: String(pageRatio) }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfViewer;
