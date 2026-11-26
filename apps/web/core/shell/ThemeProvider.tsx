'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { storageGet, storageSet } from '@/core/safeStorage';
import { flushSync } from 'react-dom';

interface ThemeContextType {
  isDark: boolean;
  setIsDark: (d: boolean) => void;
  isHighContrast: boolean;
  setIsHighContrast: (c: boolean) => void;
  isLargeText: boolean;
  setIsLargeText: (l: boolean) => void;
  isReducedMotion: boolean;
  setIsReducedMotion: (m: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

/** Theme view transitions still running (see setIsDarkUser). */
let themeSwitches = 0;

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isLargeText, setIsLargeText] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Initialize from localStorage / system after mount (SSR-safe)
  useEffect(() => {
    const stored = storageGet('sntiq_theme');
    if (stored === 'dark') setIsDark(true);
    else if (stored === 'light') setIsDark(false);
    else setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);

    setIsHighContrast(storageGet('sntiq_high_contrast') === 'true');
    setIsLargeText(storageGet('sntiq_large_text') === 'true');

    const motion = storageGet('sntiq_motion');
    if (motion !== null) setIsReducedMotion(motion === 'true');
    else setIsReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle('dark', isDark);
    // The browser chrome (mobile address bar) follows the in-app theme, not only the OS one.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', isDark ? '#030304' : '#F5F7FA'));
  }, [isDark, hydrated]);

  // Persist only on an explicit user choice: absence of the key means
  // "follow system" (pre-paint script + prefers-color-scheme listener).
  const setIsDarkUser = useCallback((d: boolean) => {
    // The class is set here as well as in the effect above so that, where the
    // browser supports view transitions, the whole page cross-fades between
    // the themes instead of snapping (unsupported browsers just switch).
    const apply = () => { document.documentElement.classList.toggle('dark', d); flushSync(() => setIsDark(d)); };
    const root = document.documentElement;
    const doc = document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };
    if (typeof doc.startViewTransition === 'function' && !root.classList.contains('reduce-motion')) {
      // The view transition is the fade. Element colour transitions running
      // inside it would show half-changed colours (dark text on a still dark
      // page, a lagging strip), so they are off while it runs.
      // Fast repeated switches overlap: the class goes only when the last
      // one has finished.
      themeSwitches += 1;
      root.classList.add('theme-switching');
      void doc.startViewTransition(apply).finished.catch(() => {}).then(() => {
        themeSwitches -= 1;
        if (themeSwitches === 0) root.classList.remove('theme-switching');
      });
    } else apply();
    storageSet('sntiq_theme', d ? 'dark' : 'light');
  }, []);

  const setIsReducedMotionUser = useCallback((m: boolean) => {
    setIsReducedMotion(m);
    storageSet('sntiq_motion', String(m));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (!storageGet('sntiq_theme')) setIsDark(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => {
      if (storageGet('sntiq_motion') === null) setIsReducedMotion(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // On <html> as well: the pre-paint script can only reach <html>, and the
    // setting must not flash off for the moment before hydration.
    document.documentElement.classList.toggle('high-contrast', isHighContrast);
    document.body.classList.toggle('high-contrast', isHighContrast);
    storageSet('sntiq_high_contrast', String(isHighContrast));
  }, [isHighContrast, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle('large-text', isLargeText);
    storageSet('sntiq_large_text', String(isLargeText));
  }, [isLargeText, hydrated]);

  // Persisted only in setIsReducedMotionUser: absence of the key means
  // "follow system" (pre-paint script + prefers-reduced-motion listener).
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle('reduce-motion', isReducedMotion);
  }, [isReducedMotion, hydrated]);

  return (
    <ThemeContext.Provider
      value={{
        isDark, setIsDark: setIsDarkUser,
        isHighContrast, setIsHighContrast,
        isLargeText, setIsLargeText,
        isReducedMotion, setIsReducedMotion: setIsReducedMotionUser,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
