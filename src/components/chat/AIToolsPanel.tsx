'use client';

export default function AIToolsPanel() {
  const handleTranslate = () => {
    alert('Автоперевод сообщений (заглушка)');
  };

  const handleSummarize = () => {
    alert('Суммаризация чата (заглушка)');
  };

  const handleAnalyzeDocument = () => {
    alert('Анализ документа (заглушка)');
  };

  return (
    <div className="flex gap-2 p-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <button
        onClick={handleTranslate}
        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        title="Перевести сообщение"
      >
        🔄 Перевод
      </button>
      <button
        onClick={handleSummarize}
        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        title="Суммаризировать диалог"
      >
        📝 Итоги
      </button>
      <button
        onClick={handleAnalyzeDocument}
        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        title="Анализ документа"
      >
        📄 Анализ
      </button>
    </div>
  );
}