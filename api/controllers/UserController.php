<?php

require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/User.php';
require_once __DIR__ . '/../classes/Post.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

/**
 * Контроллер для работы с пользователями
 */
class UserController {

    /**
     * GET /users/{username} — профиль пользователя
     */
    public function profile($username) {
        $user = new User();
        $userData = $user->getByUsername($username);

        $this->sendResponse(['user' => $userData]);
    }

    /**
     * GET /users/{username}/posts — все посты пользователя
     */
    public function posts($username) {
        $authUser = AuthMiddleware::getAuthUser();
        $currentUserId = $authUser ? $authUser['userId'] : null;

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $user = new User();
        $userData = $user->getByUsername($username);

        $post = new Post();
        $posts = $post->getByUserId($userData['id'], $limit, $offset, $currentUserId);

        $this->sendResponse(['posts' => $posts]);
    }

    /**
     * GET /users/{username}/replies — ответы пользователя
     */
    public function replies($username) {
        $authUser = AuthMiddleware::getAuthUser();
        $currentUserId = $authUser ? $authUser['userId'] : null;

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $user = new User();
        $userData = $user->getByUsername($username);

        $post = new Post();
        $replies = $post->getRepliesByUser($userData['id'], $currentUserId, $limit, $offset);

        $this->sendResponse(['replies' => $replies]);
    }

    /**
     * PATCH /user/theme — сохранение темы оформления
     */
    public function updateTheme() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        $user = new User();
        $user->updateTheme($authUser['userId'], $input['theme'] ?? '');

        $this->sendResponse(['theme' => $input['theme']]);
    }

    /**
     * PATCH /user/language — сохранение языка интерфейса
     */
    public function updateLanguage() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        $user = new User();
        $user->updateLanguage($authUser['userId'], $input['language'] ?? '');

        $this->sendResponse(['language' => $input['language']]);
    }

    /**
     * PATCH /user/profile — обновление профиля
     */
    public function updateProfile() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        $user = new User();

        // Разрешённые поля для обновления
        $allowed = ['display_name', 'bio', 'location', 'birth_date', 'avatar_url'];
        $data = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $input)) {
                $data[$field] = $input[$field] === '' ? null : $input[$field];
            }
        }

        // Валидация display_name
        if (isset($data['display_name']) && (strlen($data['display_name']) < 1 || strlen($data['display_name']) > 100)) {
            http_response_code(400);
            echo json_encode(['error' => 'Display name must be between 1 and 100 characters']);
            exit();
        }

        // Валидация avatar_url (только из /uploads/avatars/)
        if (isset($data['avatar_url']) && $data['avatar_url'] !== null) {
            if (!preg_match('#^/uploads/avatars/[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|gif|webp)$#', $data['avatar_url'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid avatar URL. Must be from /uploads/avatars/']);
                exit();
            }
        }

        $user->updateProfile($authUser['userId'], $data);
        $userData = $user->getById($authUser['userId']);

        $this->sendResponse(['user' => $userData]);
    }

    /**
     * POST /upload/avatar — загрузка аватара
     */
    public function uploadAvatar() {
        $authUser = AuthMiddleware::requireAuth();

        if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'No file uploaded']);
            exit();
        }

        $file = $_FILES['avatar'];
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        // Проверка MIME типа через file content
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedTypes)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP']);
            exit();
        }

        // Проверка размера (макс 5MB)
        if ($file['size'] > 5 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode(['error' => 'File too large (max 5MB)']);
            exit();
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

        if (!in_array($ext, $allowedExtensions)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file extension']);
            exit();
        }

        $filename = 'avatar_' . $authUser['userId'] . '_' . time() . '.' . $ext;
        $uploadDir = __DIR__ . '/../../uploads/avatars/';

        // Создание директории если не существует
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Сохранение файла
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save file']);
            exit();
        }

        $this->sendResponse(['url' => '/uploads/avatars/' . $filename], 201);
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
