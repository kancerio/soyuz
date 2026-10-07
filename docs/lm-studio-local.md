# Локальная модель через LM Studio

Ветка `feature/lm-studio-local-model` подключает LM Studio к `ai-service` через
OpenAI-совместимый endpoint. Режим `mock` остаётся значением по умолчанию.

## Запуск LM Studio

1. Скачайте и загрузите GGUF-модель в LM Studio.
2. Вкладка **Developer** → **Start Server**.
3. Проверьте список моделей:

   ```powershell
   irm http://127.0.0.1:1234/v1/models
   ```

4. Скопируйте значение `id` из ответа в `AI_MODEL`.

LM Studio не обучает GGUF-модель. Оно запускает локальный inference-сервер.
Дообучение выполняется отдельно на исходном checkpoint в Transformers-формате
через PEFT/QLoRA, после чего результат можно конвертировать в GGUF и загрузить
обратно в LM Studio.

Готовый Colab-сценарий находится в
[`notebooks/deepseek_qlora_training.ipynb`](../notebooks/deepseek_qlora_training.ipynb).
Перед запуском подготовьте SFT-файл из проверенных JSONL-строк:

```powershell
python ai-service/tools/prepare_sft_dataset.py `
  ai-service/dataset/seed.jsonl `
  $env:TEMP\soyuz_seed_sft.jsonl
```

Ноутбук по умолчанию использует исходный checkpoint
`deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B`; для 7B нужна более производительная
GPU-среда. Он сохраняет LoRA-адаптер, а не готовый GGUF.

## Запуск AI-сервиса с локальным провайдером

В `ai-service/.env` задайте:

```env
AI_PROVIDER=lmstudio
AI_BASE_URL=http://127.0.0.1:1234/v1
AI_MODEL=<id из /v1/models>
AI_API_KEY=lm-studio
AI_TIMEOUT_SECONDS=120
```

При `AI_PROVIDER=mock` внешних вызовов нет. При ошибке локального провайдера
эндпоинты возвращают HTTP 502 с понятным описанием причины.

## Ограничения текущего этапа

- GGUF, скачанный для LM Studio, предназначен для запуска и генерации данных,
  а не для прямого обучения.
- Для качественного дообучения нужны проверенные примеры в SFT-формате; текущий
  seed из 15 строк используется только как стартовая проверка конвейера.
- На 15 строках обучение будет демонстрационным и приведёт к переобучению. Перед
  рабочим запуском соберите и вручную проверьте хотя бы несколько сотен примеров,
  разделив их на `train`, `validation` и `test`.
- STT требует отдельной Whisper-модели или сервиса, потому что текстовая LLM не
  принимает аудио как вход.
