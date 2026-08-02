<?php

require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/User.php';
require_once __DIR__ . '/../classes/JWT.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../middleware/RateLimitMiddleware.php';

/**
 * Контроллер для авторизации и регистрации
 */
class AuthController {

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
        $token = JWT::encode(['userId' => $userId, 'username' => $userData['username']]);

        $this->sendResponse([
            'token' => $token,
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

        $token = JWT::encode(['userId' => $userData['id'], 'username' => $userData['username']]);

        $this->sendResponse([
            'token' => $token,
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
     * Получение JSON из тела запроса
     */
    private function getInput() {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }

    /**
     * Отправка успешного ответа
     */
    private function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode($data);
        exit();
    }
}
