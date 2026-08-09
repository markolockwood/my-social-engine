<?php

require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/User.php';
require_once __DIR__ . '/../classes/JWT.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../middleware/RateLimitMiddleware.php';
require_once __DIR__ . '/BaseController.php';

/**
 * Контроллер для авторизации и регистрации
 */
class AuthController extends BaseController {

    /**
     * POST /auth/register — регистрация нового пользователя
     */
    public function register() {
        // Лимит: 3 регистрации с одного IP за 10 минут
        RateLimitMiddleware::check('register', 3, 600);

        $input = $this->getInput();

        $user = new User();
        $userId = $user->register(
            $input['username'] ?? '',
            $input['email'] ?? '',
            $input['password'] ?? '',
            $input['displayName'] ?? ''
        );

        $userData = $user->getById($userId);

        // Создаём access token (15 минут) и refresh token (30 дней)
        $tokens = $this->generateTokenPair($userId, $userData['username']);

        $this->sendResponse([
            'accessToken' => $tokens['accessToken'],
            'refreshToken' => $tokens['refreshToken'],
            'user' => $userData
        ], 201);
    }

    /**
     * POST /auth/login — вход по логину/паролю
     */
    public function login() {
        // Лимит: 5 попыток входа за 5 минут
        RateLimitMiddleware::check('login', 5, 300);

        $input = $this->getInput();

        $user = new User();
        $userData = $user->login(
            $input['username'] ?? '',
            $input['password'] ?? ''
        );

        // Сбросить счетчик после успешного логина
        RateLimitMiddleware::reset('login');

        // Создаём access token (15 минут) и refresh token (30 дней)
        $tokens = $this->generateTokenPair($userData['id'], $userData['username']);

        $this->sendResponse([
            'accessToken' => $tokens['accessToken'],
            'refreshToken' => $tokens['refreshToken'],
            'user' => $userData
        ]);
    }

    /**
     * GET /auth/me — возвращает данные текущего пользователя
     */
    public function me() {
        $authUser = AuthMiddleware::requireAuth();

        $user = new User();
        $userData = $user->getById($authUser['userId']);

        $this->sendResponse(['user' => $userData]);
    }

    /**
     * POST /auth/refresh — обновление access token по refresh token
     */
    public function refresh() {
        $input = $this->getInput();
        $refreshToken = $input['refreshToken'] ?? '';

        if (empty($refreshToken)) {
            http_response_code(400);
            echo json_encode(['error' => 'Refresh token is required']);
            exit();
        }

        $db = Database::getInstance();

        // Находим refresh token в БД и проверяем срок действия
        $stmt = $db->query(
            "SELECT user_id, username FROM refresh_tokens rt
             JOIN users u ON rt.user_id = u.id
             WHERE rt.token = ? AND rt.expires_at > NOW()",
            [$refreshToken]
        );
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid or expired refresh token']);
            exit();
        }

        // Обновляем last_used_at
        $db->query(
            "UPDATE refresh_tokens SET last_used_at = NOW() WHERE token = ?",
            [$refreshToken]
        );

        // Выдаём новый access token
        $accessToken = JWT::encode([
            'userId' => $row['user_id'],
            'username' => $row['username']
        ]);

        $this->sendResponse(['accessToken' => $accessToken]);
    }

    /**
     * POST /auth/logout — выход (удаление refresh token)
     */
    public function logout() {
        $input = $this->getInput();
        $refreshToken = $input['refreshToken'] ?? '';

        if (!empty($refreshToken)) {
            $db = Database::getInstance();
            $db->query("DELETE FROM refresh_tokens WHERE token = ?", [$refreshToken]);
        }

        $this->sendResponse(['message' => 'Logged out successfully']);
    }

    /**
     * POST /auth/logout-all — выход на всех устройствах
     */
    public function logoutAll() {
        $authUser = AuthMiddleware::requireAuth();

        $db = Database::getInstance();
        $db->query("DELETE FROM refresh_tokens WHERE user_id = ?", [$authUser['userId']]);

        $this->sendResponse(['message' => 'Logged out from all devices']);
    }

    /**
     * Генерация пары токенов: access (15 мин) + refresh (30 дней)
     */
    private function generateTokenPair($userId, $username) {
        // Access token (короткий)
        $accessToken = JWT::encode([
            'userId' => $userId,
            'username' => $username
        ]);

        // Refresh token (длинный, случайная строка)
        $refreshToken = bin2hex(random_bytes(32));

        // Сохраняем refresh token в БД
        $db = Database::getInstance();
        $db->query(
            "INSERT INTO refresh_tokens (user_id, token, expires_at, ip_address, user_agent)
             VALUES (?, ?, NOW() + INTERVAL '30 days', ?, ?)",
            [
                $userId,
                $refreshToken,
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null
            ]
        );

        return [
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken
        ];
    }
}
