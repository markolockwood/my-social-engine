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
     * Получить IP адрес клиента с защитой от IP spoofing
     */
    public static function getClientIp() {
        $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

        // Список доверенных прокси (локальный Nginx)
        $trustedProxies = [
            '127.0.0.1',
            '::1',
            // Добавьте IP вашего прокси-сервера если он внешний
            // Для CloudFlare раскомментируйте и добавьте их IP ranges
        ];

        // Если запрос НЕ от доверенного прокси - используем REMOTE_ADDR напрямую
        if (!in_array($remoteAddr, $trustedProxies)) {
            return filter_var($remoteAddr, FILTER_VALIDATE_IP) ? $remoteAddr : '0.0.0.0';
        }

        // Запрос от доверенного прокси (Nginx) - проверяем X-Forwarded-For
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
            $clientIp = $ips[0]; // Первый IP в цепочке = реальный клиент

            // Валидация IP-адреса
            if (filter_var($clientIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $clientIp;
            }
        }

        // Fallback на REMOTE_ADDR
        return filter_var($remoteAddr, FILTER_VALIDATE_IP) ? $remoteAddr : '0.0.0.0';
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
