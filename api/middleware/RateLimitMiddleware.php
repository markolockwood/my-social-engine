<?php

/**
 * Middleware для ограничения частоты запросов (Rate Limiting)
 * Использует APCu для хранения счетчиков в памяти
 */
class RateLimitMiddleware {

    /**
     * Проверить лимит запросов для конкретного действия
     *
     * @param string $action - Название действия (login, register, create_post)
     * @param int $maxAttempts - Максимальное количество попыток
     * @param int $windowSeconds - Временное окно в секундах
     * @param string|null $identifier - Идентификатор (по умолчанию IP)
     * @throws Exception если лимит превышен
     */
    public static function check($action, $maxAttempts, $windowSeconds, $identifier = null) {
        // Если APCu недоступен, пропускаем проверку
        if (!function_exists('apcu_fetch')) {
            return;
        }

        // Используем IP или переданный идентификатор
        if ($identifier === null) {
            $identifier = self::getClientIp();
        }

        $key = "ratelimit:{$action}:{$identifier}";
        $attempts = apcu_fetch($key);

        if ($attempts === false) {
            // Первая попытка
            apcu_store($key, 1, $windowSeconds);
            return;
        }

        if ($attempts >= $maxAttempts) {
            http_response_code(429);
            header('Retry-After: ' . $windowSeconds);
            echo json_encode([
                'error' => 'Too many requests. Please try again later.',
                'retry_after' => $windowSeconds
            ]);
            exit();
        }

        // Увеличиваем счетчик
        apcu_inc($key);
    }

    /**
     * Получить IP адрес клиента
     */
    private static function getClientIp() {
        // Проверяем заголовки прокси
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
        } elseif (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            $ip = $_SERVER['HTTP_X_REAL_IP'];
        } else {
            $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        }

        return trim($ip);
    }

    /**
     * Сбросить счетчик для пользователя (например, после успешного логина)
     */
    public static function reset($action, $identifier = null) {
        if (!function_exists('apcu_delete')) {
            return;
        }

        if ($identifier === null) {
            $identifier = self::getClientIp();
        }

        $key = "ratelimit:{$action}:{$identifier}";
        apcu_delete($key);
    }
}
