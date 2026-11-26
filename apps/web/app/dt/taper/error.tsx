'use client';

/** MODULE ISOLATION BOUNDARY for /dt/taper. */

import { useEffect } from 'react';
import ErrorView from '@/core/shell/ErrorView';

export default function TaperErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[SNTIQ:TAPER] Module error. Code: ${error.digest ?? 'ERR-AG'}`);
  }, [error]);

  return <ErrorView code="500" digest={error.digest} onRetry={reset} />;
}
