'use client';

/**
 * MODULE ISOLATION BOUNDARY for /dt/lathe.
 * A crash inside the Lathe module never takes down the rest of the site:
 * Header, Footer and all other routes keep working. Only a sanitized
 * error code (Next.js digest) is logged — never form data.
 */

import { useEffect } from 'react';
import ErrorView from '@/core/shell/ErrorView';

export default function LatheErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`[SNTIQ:LATHE] Module error. Code: ${error.digest ?? 'ERR-LATHE'}`);
  }, [error]);

  return <ErrorView code="500" digest={error.digest} onRetry={reset} />;
}
