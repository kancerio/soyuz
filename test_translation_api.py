import requests
import json
import time

BASE_URL = "http://localhost:8001"  # твой порт
ENDPOINT = f"{BASE_URL}/api/v1/translate"

def test_case(name, payload, expected_status, expected_contains=None, correlation_id_check=False):
    print(f"\n▶️  {name}")
    try:
        resp = requests.post(ENDPOINT, json=payload, timeout=5)
        status = resp.status_code
        ok = (status == expected_status)
        if ok and expected_contains:
            if isinstance(expected_contains, str):
                ok = expected_contains in resp.text
            elif isinstance(expected_contains, dict):
                for k, v in expected_contains.items():
                    if resp.json().get(k) != v:
                        ok = False
                        break
        if correlation_id_check and ok:
            corr_id = resp.json().get("correlation_id")
            if corr_id != payload.get("correlation_id"):
                ok = False
                print(f"   correlation_id mismatch: expected {payload.get('correlation_id')}, got {corr_id}")
        print(f"   Status: {status} (expected {expected_status}) – {'✅' if ok else '❌'}")
        if not ok:
            print(f"   Response: {resp.text[:200]}")
        return ok
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def main():
    print("=== Запуск тест-кейсов перевода ===\n")
    results = []

    # TC1
    results.append(test_case("TC1: Короткий текст", {"text": "Hello", "target_lang": "ru"}, 200, "[mock_ru]"))

    # TC2: длинный текст (1000+ символов)
    long_text = "Lorem ipsum " * 100
    results.append(test_case("TC2: Длинный текст", {"text": long_text, "target_lang": "ru"}, 200, "[mock_ru]"))

    # TC3: пустой текст
    results.append(test_case("TC3: Пустой текст", {"text": "", "target_lang": "ru"}, 400, "Text cannot be empty"))

    # TC4: неизвестный язык
    results.append(test_case("TC4: Неизвестный язык", {"text": "Hello", "target_lang": "xyz"}, 400, "Unsupported target language"))

    # TC5: ошибка AI-сервиса – имитируем, отправив запрос на несуществующий порт (отключать контейнер не будем)
    # Но можно попросить пользователя запустить отдельно. Для автоматизации пропустим с предупреждением.
    print("\n⚠️  TC5 (ошибка AI) пропущен – требует ручного отключения контейнера.")

    # TC6: несколько языковых пар
    for lang in ["de", "fr", "es"]:
        results.append(test_case(f"TC6: Языковая пара {lang}", {"text": "Hello", "target_lang": lang}, 200, f"[mock_{lang}]"))

    # TC7: с correlation_id
    corr_id = "auto-test-123"
    results.append(test_case("TC7: Передача correlation_id", 
        {"text": "Hi", "target_lang": "ru", "correlation_id": corr_id}, 200, 
        correlation_id_check=True))

    # TC8: автоопределение source_lang (не передаём) – ожидаем 200, не важно значение source_lang_detected
    results.append(test_case("TC8: Автоопределение source_lang", {"text": "Bonjour", "target_lang": "ru"}, 200, None))

    print("\n=== РЕЗУЛЬТАТ ===")
    total = len(results)
    passed = sum(results)
    print(f"Пройдено: {passed} из {total}")
    if passed == total:
        print("✅ Все тесты успешно выполнены")
    else:
        print(f"❌ Не пройдено {total - passed} тестов")

if __name__ == "__main__":
    main()