'use client';

/** MODULE ISOLATION BOUNDARY for /dt/kerf. */

import { useEffect } from 'react';
import ErrorView from '@/core/shell/ErrorView';

export default function KerfErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[SNTIQ:KERF] Module error. Code: ${error.digest ?? 'ERR-LX'}`);
  }, [error]);

  return <ErrorView code="500" digest={error.digest} onRetry={reset} />;
}
