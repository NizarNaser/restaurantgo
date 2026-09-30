import { useTranslation } from 'react-i18next';

export default function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('errorFallback.title')}</h1>
      <p className="text-gray-600 mb-8 max-w-sm">{t('errorFallback.message')}</p>
      <button onClick={() => window.location.reload()} className="btn btn-primary">
        {t('errorFallback.reload')}
      </button>
    </div>
  );
}
