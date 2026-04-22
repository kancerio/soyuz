'use client';

import { useLanguage } from '@/context/LanguageContext';

export default function AIToolsPanel() {
  const { t } = useLanguage();

  const handleTranslate = () => alert(t('translate'));
  const handleSummarize = () => alert(t('summary'));
  const handleAnalyzeDocument = () => alert(t('document_analysis'));

  return (
    <div className="flex gap-2 p-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <button onClick={handleTranslate} className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">{t('translate')}</button>
      <button onClick={handleSummarize} className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">{t('summary')}</button>
      <button onClick={handleAnalyzeDocument} className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">{t('document_analysis')}</button>
    </div>
  );
}