<?php

require_once __DIR__ . '/../classes/JWT.php';

/**
 * Middleware для проверки авторизации
 */
class AuthMiddleware {

    /**
     * Извлекает Bearer-токен из заголовка Authorization
     * @return array|null Данные пользователя из токена или null
     */
    public static function getAuthUser() {
        $authHeader = null;

        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        }

        if (!$authHeader) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
        }

        if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return null;
        }

        try {
            $token = $matches[1];
            $payload = JWT::decode($token);
            return $payload;
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Требует наличие токена авторизации
     * @return array Данные пользователя из токена
     */
    public static function requireAuth() {
        $user = self::getAuthUser();

        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit();
        }

        return $user;
    }
}
