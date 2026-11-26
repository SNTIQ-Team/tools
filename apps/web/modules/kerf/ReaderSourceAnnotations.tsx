import React from 'react';
import StructuredReaderText from './StructuredReaderText';
import type { ReaderNode } from './readerStructure';
import styles from './reader.module.css';

type Props = Omit<React.ComponentProps<typeof StructuredReaderText>, 'nodes'> & { annotations: ReaderNode[]; label: string };

export default function ReaderSourceAnnotations({ annotations, label, ...context }: Props) {
  if (!annotations.length) return null;
  return <aside role="note" aria-label={label} className={`${styles.legalText} ${styles.sourceAnnotations}`} data-reader-source-annotations>
    <h4>{label}</h4>
    <StructuredReaderText {...context} nodes={annotations} />
  </aside>;
}
