'use client';

/** Tiny transient toast (copy feedback etc.) — bottom-centered. */

import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import s from '../chamfer.module.css';

const Toast: React.FC<{
  kind: 'ok' | 'fail';
  text: string;
  onDone: () => void;
}> = ({ kind, text, onDone }) => {
  useEffect(() => {
    const id = setTimeout(onDone, 2200);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div role="status" data-kind={kind} className={`sntiq-float ${s.toast}`}>
      {kind === 'ok' ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
      {text}
    </div>
  );
};

export default Toast;
