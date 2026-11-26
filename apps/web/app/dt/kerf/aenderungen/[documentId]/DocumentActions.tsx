'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2, Printer } from 'lucide-react';
import doc from '@/modules/kerf/documentPage.module.css';

export default function DocumentActions({
  apiUrl, citation, fileName,
}: {
  apiUrl: string;
  citation: string;
  fileName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
    }
  };

  const downloadJson = async () => {
    setDownloading(true);
    setError(false);
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.blob();
      const url = URL.createObjectURL(payload);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setError(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-w-0 print:hidden">
      <div className={doc.actionRow}>
        <button type="button" onClick={copyCitation} className="sntiq-btn">
          {copied
            ? <Check size={16} className="shrink-0" style={{ color: 'var(--c-ok)' }} aria-hidden="true" />
            : <Copy size={16} className="shrink-0" aria-hidden="true" />}
          <span className="break-words">{copied ? 'Fundstelle kopiert' : 'Fundstelle kopieren'}</span>
        </button>
        <button type="button" onClick={downloadJson} disabled={downloading} className="sntiq-btn">
          {downloading
            ? <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden="true" />
            : <Download size={16} className="shrink-0" aria-hidden="true" />}
          <span className="break-words">JSON herunterladen</span>
        </button>
        <button type="button" onClick={() => window.print()} className="sntiq-btn">
          <Printer size={16} className="shrink-0" aria-hidden="true" />
          <span className="break-words">Drucken / PDF</span>
        </button>
      </div>
      {error && (
        <p role="alert" className={doc.alert}>
          Aktion fehlgeschlagen. Die API-Fundstelle kann unten direkt geöffnet werden.
        </p>
      )}
    </div>
  );
}
