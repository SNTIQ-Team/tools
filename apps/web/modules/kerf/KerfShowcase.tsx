'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { KERF_SHOWCASE_HREF, kerfShowcaseCopy } from './showcaseContent';
import styles from './showcase.module.css';

export default function KerfShowcase() {
  const { i18n } = useTranslation('main');
  const copy = kerfShowcaseCopy(i18n.language);
  const preview = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!preview.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setRevealed(true); observer.disconnect(); }
    }, { threshold: 0.12 });
    observer.observe(preview.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="kerf" className={styles.band} aria-labelledby="kerf-showcase-title">
      <div className={styles.content}>
        <header className={styles.heading}>
          <div>
            <h2 id="kerf-showcase-title">Kerf</h2>
            <p>{copy.description}</p>
          </div>
          <div className={styles.actions}>
            <Link href={KERF_SHOWCASE_HREF} className={styles.primaryAction}>
              <span>{copy.openKerf}</span><ArrowRight size={22} aria-hidden="true" />
            </Link>
            <Link href="/dt/chamfer" className={styles.secondaryAction}>
              <span>{copy.openChamfer}</span><ArrowRight size={22} aria-hidden="true" />
            </Link>
          </div>
        </header>
        <figure ref={preview} className={styles.preview} data-revealed={revealed} aria-label={copy.preview}>
          <div className={styles.imageArea}>
            {/* Real captures follow the viewport and site's manual theme switch. */}
            <picture className={styles.lightImage}>
              <source media="(max-width: 640px)" srcSet="/images/kerf-reader-mobile-light.png" width={366} height={954} />
              <img src="/images/kerf-reader-light.png" alt={copy.preview} width={1440} height={800} loading="lazy" decoding="async" />
            </picture>
            <picture className={styles.darkImage}>
              <source media="(max-width: 640px)" srcSet="/images/kerf-reader-mobile-dark.png" width={366} height={954} />
              <img src="/images/kerf-reader-dark.png" alt={copy.preview} width={1440} height={800} loading="lazy" decoding="async" />
            </picture>
          </div>
        </figure>
      </div>
    </section>
  );
}
