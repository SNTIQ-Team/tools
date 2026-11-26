'use client';

import { useTranslation } from 'react-i18next';

export default function ErrorView({ code, digest, onRetry }: { code: string; digest?: string; onRetry?: () => void }) {
  const { t } = useTranslation('error');
  return <section className="tools-index" role="alert"><h1>{t(code + '.title')}</h1>
    <p>{t(code + '.desc')}</p>{digest && <code>{digest}</code>}
    {onRetry && <button type="button" className="sntiq-btn" onClick={onRetry}>{t('retry')}</button>}
  </section>;
}
