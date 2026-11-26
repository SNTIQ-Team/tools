'use client';

/**
 * MODULE ISOLATION BOUNDARY for /dt/chamfer.
 * A crash inside the Chamfer module never takes down the rest of
 * the site: Header, Footer and all other routes keep working. Only a
 * sanitized error code (Next.js digest) is logged — never user data.
 */

import { useEffect } from 'react';
import ErrorView from '@/core/shell/ErrorView';

export default function ChamferErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[SNTIQ:CHAMFER] Module error. Code: ${error.digest ?? 'ERR-SB'}`,
    );
  }, [error]);

  return <ErrorView code="500" digest={error.digest} onRetry={reset} />;
}
