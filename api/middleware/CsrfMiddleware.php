<?php

/**
 * Middleware для защиты от CSRF атак через проверку Origin/Referer
 * Для JWT-авторизованных запросов проверка более мягкая
 */
class CsrfMiddleware {

    /**
     * Проверяет, что запрос пришел с доверенного домена
     * Для запросов с Authorization токеном проверка более мягкая
     */
    public static function verify() {
        $method = $_SERVER['REQUEST_METHOD'];

        // Проверяем только state-changing методы
        if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            return;
        }

        // Список разрешенных origin
        $allowedOrigins = [
            'http://localhost:5173',  // Vite dev server
            'http://localhost',
            'http://127.0.0.1',
            'http://127.0.0.1:5173',
            'http://mytwit.com',
            // Добавьте ваш продакшен домен:
            // 'https://mytwit.com',
            // 'https://www.mytwit.com',
        ];

        // Проверяем Origin заголовок (приоритетнее)
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        // Если Origin нет, проверяем Referer
        if (empty($origin) && !empty($_SERVER['HTTP_REFERER'])) {
            $parsed = parse_url($_SERVER['HTTP_REFERER']);
            if ($parsed !== false) {
                $origin = ($parsed['scheme'] ?? 'http') . '://' . ($parsed['host'] ?? '');
                // Добавляем порт если есть и не стандартный
                if (isset($parsed['port']) && !in_array($parsed['port'], [80, 443])) {
                    $origin .= ':' . $parsed['port'];
                }
            }
        }

        // Если есть валидный Origin/Referer - проверяем whitelist
        if (!empty($origin)) {
            if (!in_array($origin, $allowedOrigins)) {
                error_log("CSRF validation failed. Origin: {$origin}, Method: {$method}, Path: {$_SERVER['REQUEST_URI']}");
                http_response_code(403);
                echo json_encode(['error' => 'CSRF validation failed']);
                exit();
            }
            // Origin валиден - пропускаем
            return;
        }

        // Если нет Origin/Referer - проверяем наличие Authorization токена
        // JWT в localStorage делает CSRF менее критичным (нужен доступ к localStorage жертвы)
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (empty($authHeader) && function_exists('getallheaders')) {
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? '';
        }

        if (empty($authHeader) || !preg_match('/^Bearer\s+.+$/i', $authHeader)) {
            // Нет ни Origin, ни токена - блокируем
            error_log("CSRF validation failed. No Origin/Referer and no Authorization token. Method: {$method}, Path: {$_SERVER['REQUEST_URI']}");
            http_response_code(403);
            echo json_encode(['error' => 'CSRF validation failed: missing origin or authorization']);
            exit();
        }

        // Есть Authorization токен - пропускаем (JWT в localStorage уже защита от CSRF)
        // Злоумышленник не может украсть токен из localStorage другого домена
    }
}
