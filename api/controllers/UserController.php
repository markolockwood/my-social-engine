<?php

require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/User.php';
require_once __DIR__ . '/../classes/Post.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/FileValidator.php';
require_once __DIR__ . '/../config/FileUploadConfig.php';
require_once __DIR__ . '/BaseController.php';

/**
 * Контроллер для работы с пользователями
 */
class UserController extends BaseController {

    /**
     * GET /users/{username} — профиль пользователя
     */
    public function profile($username) {
        $authUser = AuthMiddleware::getAuthUser();
        $currentUserId = $authUser ? $authUser['userId'] : null;

        $user = new User();
        $userData = $user->getByUsername($username);

        // Если пользователь авторизован, проверяем статус подписки
        if ($currentUserId && $currentUserId !== $userData['id']) {
            $db = Database::getInstance();

            // Проверяем подписку
            $isFollowing = $user->isFollowing($currentUserId, $userData['id']);

            if ($isFollowing) {
                $userData['follow_status'] = 'following';
            } else {
                // Проверяем наличие отправленного запроса
                $pendingRequest = $db->query(
                    "SELECT id FROM follow_requests WHERE follower_id = ? AND following_id = ?",
                    [$currentUserId, $userData['id']]
                )->fetch();

                $userData['follow_status'] = $pendingRequest ? 'pending' : 'none';
            }

            $userData['is_following'] = $isFollowing;
        } else {
            $userData['is_following'] = false;
            $userData['follow_status'] = 'none';
        }

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

        // Проверка: если посты защищены и текущий пользователь не подписан
        if ($userData['protected_posts'] === true || $userData['protected_posts'] === 't') {
            // Владелец аккаунта видит свои посты
            if ($currentUserId === $userData['id']) {
                $post = new Post();
                $posts = $post->getByUserId($userData['id'], $limit, $offset, $currentUserId);
                $this->sendResponse(['posts' => $posts, 'protected' => false]);
                return;
            }

            // Проверяем подписку
            if (!$currentUserId || !$user->isFollowing($currentUserId, $userData['id'])) {
                // Не подписан - возвращаем пустой массив с флагом protected
                $this->sendResponse(['posts' => [], 'protected' => true]);
                return;
            }
        }

        // Посты не защищены или пользователь подписан
        $post = new Post();
        $posts = $post->getByUserId($userData['id'], $limit, $offset, $currentUserId);
        $this->sendResponse(['posts' => $posts, 'protected' => false]);
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

        // Проверка: если посты защищены и текущий пользователь не подписан
        if ($userData['protected_posts'] === true || $userData['protected_posts'] === 't') {
            // Владелец аккаунта видит свои ответы
            if ($currentUserId === $userData['id']) {
                $post = new Post();
                $replies = $post->getRepliesByUser($userData['id'], $currentUserId, $limit, $offset);
                $this->sendResponse(['replies' => $replies, 'protected' => false]);
                return;
            }

            // Проверяем подписку
            if (!$currentUserId || !$user->isFollowing($currentUserId, $userData['id'])) {
                // Не подписан - возвращаем пустой массив с флагом protected
                $this->sendResponse(['replies' => [], 'protected' => true]);
                return;
            }
        }

        // Посты не защищены или пользователь подписан
        $post = new Post();
        $replies = $post->getRepliesByUser($userData['id'], $currentUserId, $limit, $offset);
        $this->sendResponse(['replies' => $replies, 'protected' => false]);
    }

    /**
     * GET /user/account-info — получение информации об аккаунте
     */
    public function getAccountInfo() {
        $authUser = AuthMiddleware::requireAuth();

        $user = new User();
        $userData = $user->getById($authUser['userId']);

        // Добавляем дополнительную информацию для раздела Account Information
        $accountInfo = [
            'id' => $userData['id'],
            'username' => $userData['username'],
            'email' => $userData['email'],
            'display_name' => $userData['display_name'],
            'bio' => $userData['bio'],
            'location' => $userData['location'],
            'birth_date' => $userData['birth_date'],
            'avatar_url' => $userData['avatar_url'],
            'created_at' => $userData['created_at'],
            'verified' => $userData['verified'] ?? false,
            'registration_ip' => $userData['registration_ip'] ?? null,
            'registration_country' => $this->getCountryByIP($userData['registration_ip'] ?? null),
            'country' => $userData['country'] ?? null,
            'gender' => $userData['gender'] ?? null,
        ];

        $this->sendResponse($accountInfo);
    }

    /**
     * PATCH /user/username — смена имени пользователя
     */
    public function updateUsername() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        $username = trim($input['username'] ?? '');

        // Валидация
        if (strlen($username) < 3 || strlen($username) > 50) {
            http_response_code(400);
            echo json_encode(['error' => 'Username must be between 3 and 50 characters']);
            exit();
        }

        if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
            http_response_code(400);
            echo json_encode(['error' => 'Username can only contain letters, numbers and underscores']);
            exit();
        }

        // Проверка уникальности
        $db = Database::getInstance();
        $existing = $db->query("SELECT id FROM users WHERE username = ? AND id != ?", [$username, $authUser['userId']])->fetch();

        if ($existing) {
            http_response_code(400);
            // Обобщенное сообщение - защита от user enumeration
            echo json_encode(['error' => 'Username change failed']);
            exit();
        }

        // Обновление
        $db->query("UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?", [$username, $authUser['userId']]);

        $this->sendResponse(['username' => $username]);
    }

    /**
     * PATCH /user/country — смена страны
     */
    public function updateCountry() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        $country = trim($input['country'] ?? '');

        if (strlen($country) !== 2) {
            http_response_code(400);
            echo json_encode(['error' => 'Country code must be 2 characters']);
            exit();
        }

        $db = Database::getInstance();
        $db->query("UPDATE users SET country = ?, updated_at = NOW() WHERE id = ?", [$country, $authUser['userId']]);

        $this->sendResponse(['country' => $country]);
    }

    /**
     * PATCH /user/gender — смена пола
     */
    public function updateGender() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        $gender = trim($input['gender'] ?? '');

        // Пустое значение разрешено (опциональное поле)
        if ($gender === '') {
            $db = Database::getInstance();
            $db->query("UPDATE users SET gender = NULL, updated_at = NOW() WHERE id = ?", [$authUser['userId']]);
            $this->sendResponse(['gender' => null]);
            return;
        }

        // Whitelist разрешенных значений для защиты от инъекций
        $allowedGenders = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];

        if (!in_array($gender, $allowedGenders)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid gender value']);
            exit();
        }

        $db = Database::getInstance();
        $db->query("UPDATE users SET gender = ?, updated_at = NOW() WHERE id = ?", [$gender, $authUser['userId']]);

        $this->sendResponse(['gender' => $gender]);
    }

    /**
     * Определение страны по IP через бесплатный API
     */
    private function getCountryByIP($ip) {
        if (!$ip || $ip === '127.0.0.1' || $ip === '::1') {
            return null;
        }

        // Валидация IP
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return null;
        }

        try {
            // ip-api.com - 45 запросов/минуту бесплатно (без ключа)
            // Альтернативы: ipapi.co, ipwhois.app, freegeoip.app
            $url = "http://ip-api.com/json/{$ip}?fields=country";

            $context = stream_context_create([
                'http' => [
                    'timeout' => 3, // Таймаут 3 секунды
                    'ignore_errors' => true
                ]
            ]);

            $response = @file_get_contents($url, false, $context);

            if ($response === false) {
                error_log("GeoIP API request failed for IP: {$ip}");
                return null;
            }

            $data = json_decode($response, true);

            if (isset($data['country']) && !empty($data['country'])) {
                return $data['country'];
            }

            return null;

        } catch (Exception $e) {
            error_log("GeoIP API error: " . $e->getMessage());
            return null;
        }
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
     * PATCH /user/video-volume — сохранение уровня громкости видео
     */
    public function updateVideoVolume() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        $volume = floatval($input['volume'] ?? 0.45);
        $volume = max(0, min(1, $volume)); // Ограничиваем 0.0-1.0

        $db = Database::getInstance();
        $db->query("UPDATE users SET video_volume = ? WHERE id = ?", [$volume, $authUser['userId']]);

        $this->sendResponse(['volume' => $volume]);
    }

    /**
     * PATCH /user/protected-posts — включение/выключение защиты постов
     */
    public function updateProtectedPosts() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        // Получаем значение как boolean
        $protectedPosts = isset($input['protected_posts']) && $input['protected_posts'] === true;

        $db = Database::getInstance();
        // PostgreSQL принимает boolean как true/false
        $db->query(
            "UPDATE users SET protected_posts = ?, updated_at = NOW() WHERE id = ?",
            [$protectedPosts ? 'true' : 'false', $authUser['userId']]
        );

        $this->sendResponse(['protected_posts' => $protectedPosts]);
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
        $allowedTypes = FileUploadConfig::getAllowedMimes('avatar');

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
        $maxSize = FileUploadConfig::getMaxSize('avatar');
        if ($file['size'] > $maxSize) {
            http_response_code(400);
            echo json_encode(['error' => 'File too large (max 5MB)']);
            exit();
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExtensions = FileUploadConfig::getAllowedExtensions('avatar');

        if (!in_array($ext, $allowedExtensions)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file extension']);
            exit();
        }

        $filename = 'avatar_' . $authUser['userId'] . '_' . time() . '.' . $ext;
        $uploadDir = FileUploadConfig::getUploadDir('avatars');

        // Сохранение файла
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save file']);
            exit();
        }

        // Дополнительная проверка файла после загрузки (magic bytes)
        if (!FileValidator::isValidImage($uploadDir . $filename)) {
            unlink($uploadDir . $filename); // Удаляем подделку
            http_response_code(400);
            echo json_encode(['error' => 'Invalid image file detected']);
            exit();
        }

        $this->sendResponse(['url' => '/uploads/avatars/' . $filename], 201);
    }

    /**
     * POST /users/{username}/follow — подписка на пользователя
     */
    public function follow($username) {
        $authUser = AuthMiddleware::requireAuth();

        $user = new User();
        $targetUser = $user->getByUsername($username);
        $db = Database::getInstance();

        // Проверка: если целевой пользователь защищён
        if ($targetUser['protected_posts'] === true || $targetUser['protected_posts'] === 't') {
            // Проверяем, есть ли встречный запрос от целевого пользователя
            $reverseRequest = $db->query(
                "SELECT id FROM follow_requests WHERE follower_id = ? AND following_id = ?",
                [$targetUser['id'], $authUser['userId']]
            )->fetch();

            if ($reverseRequest) {
                // Встречный запрос существует → взаимная подписка
                // Удаляем запрос
                $db->query("DELETE FROM follow_requests WHERE id = ?", [$reverseRequest['id']]);

                // Создаём обе подписки
                $user->follow($authUser['userId'], $targetUser['id']);
                $user->follow($targetUser['id'], $authUser['userId']);

                $this->sendResponse([
                    'success' => true,
                    'follow_status' => 'following',
                    'message' => 'Mutual follow established'
                ]);
                return;
            }

            // Проверяем, не отправлен ли уже запрос
            $existingRequest = $db->query(
                "SELECT id FROM follow_requests WHERE follower_id = ? AND following_id = ?",
                [$authUser['userId'], $targetUser['id']]
            )->fetch();

            if ($existingRequest) {
                $this->sendResponse([
                    'success' => true,
                    'follow_status' => 'pending',
                    'message' => 'Follow request already sent'
                ]);
                return;
            }

            // Создаём запрос на подписку
            $db->query(
                "INSERT INTO follow_requests (follower_id, following_id) VALUES (?, ?)",
                [$authUser['userId'], $targetUser['id']]
            );

            $this->sendResponse([
                'success' => true,
                'follow_status' => 'pending',
                'message' => 'Follow request sent'
            ]);
        } else {
            // Аккаунт не защищён — обычная подписка
            $user->follow($authUser['userId'], $targetUser['id']);

            $this->sendResponse([
                'success' => true,
                'follow_status' => 'following',
                'message' => 'Successfully followed user'
            ]);
        }
    }

    /**
     * DELETE /users/{username}/follow — отписка от пользователя
     */
    public function unfollow($username) {
        $authUser = AuthMiddleware::requireAuth();

        $user = new User();
        $targetUser = $user->getByUsername($username);

        $user->unfollow($authUser['userId'], $targetUser['id']);

        $this->sendResponse([
            'success' => true,
            'message' => 'Successfully unfollowed user'
        ]);
    }

    /**
     * GET /user/follow-requests — список входящих запросов на подписку
     */
    public function getFollowRequests() {
        $authUser = AuthMiddleware::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->query(
            "SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, fr.created_at
             FROM follow_requests fr
             JOIN users u ON fr.follower_id = u.id
             WHERE fr.following_id = ?
             ORDER BY fr.created_at DESC",
            [$authUser['userId']]
        );

        $requests = $stmt->fetchAll();

        $this->sendResponse(['requests' => $requests]);
    }

    /**
     * GET /user/follow-requests/count — количество входящих запросов
     */
    public function getFollowRequestsCount() {
        $authUser = AuthMiddleware::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->query(
            "SELECT COUNT(*) as count FROM follow_requests WHERE following_id = ?",
            [$authUser['userId']]
        );

        $result = $stmt->fetch();

        $this->sendResponse(['count' => (int)$result['count']]);
    }

    /**
     * POST /user/follow-requests/{username}/accept — принять запрос на подписку
     */
    public function acceptFollowRequest($username) {
        $authUser = AuthMiddleware::requireAuth();
        $db = Database::getInstance();

        $user = new User();
        $requester = $user->getByUsername($username);

        // Проверяем существование запроса
        $request = $db->query(
            "SELECT id FROM follow_requests WHERE follower_id = ? AND following_id = ?",
            [$requester['id'], $authUser['userId']]
        )->fetch();

        if (!$request) {
            http_response_code(404);
            echo json_encode(['error' => 'Follow request not found']);
            exit();
        }

        // Удаляем запрос
        $db->query("DELETE FROM follow_requests WHERE id = ?", [$request['id']]);

        // Создаём подписку
        $user->follow($requester['id'], $authUser['userId']);

        $this->sendResponse([
            'success' => true,
            'message' => 'Follow request accepted'
        ]);
    }

    /**
     * POST /user/follow-requests/{username}/decline — отклонить запрос на подписку
     */
    public function declineFollowRequest($username) {
        $authUser = AuthMiddleware::requireAuth();
        $db = Database::getInstance();

        $user = new User();
        $requester = $user->getByUsername($username);

        // Удаляем запрос
        $db->query(
            "DELETE FROM follow_requests WHERE follower_id = ? AND following_id = ?",
            [$requester['id'], $authUser['userId']]
        );

        $this->sendResponse([
            'success' => true,
            'message' => 'Follow request declined'
        ]);
    }

    /**
     * DELETE /user/follow-requests/{username} — отменить свой отправленный запрос
     */
    public function cancelFollowRequest($username) {
        $authUser = AuthMiddleware::requireAuth();
        $db = Database::getInstance();

        $user = new User();
        $targetUser = $user->getByUsername($username);

        // Удаляем свой запрос
        $db->query(
            "DELETE FROM follow_requests WHERE follower_id = ? AND following_id = ?",
            [$authUser['userId'], $targetUser['id']]
        );

        $this->sendResponse([
            'success' => true,
            'message' => 'Follow request cancelled'
        ]);
    }

    /**
     * GET /users/{username}/followers — список подписчиков
     */
    public function followers($username) {
        $authUser = AuthMiddleware::getAuthUser();
        $currentUserId = $authUser ? $authUser['userId'] : null;

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $user = new User();
        $targetUser = $user->getByUsername($username);
        $followers = $user->getFollowers($targetUser['id'], $limit, $offset, $currentUserId);

        $this->sendResponse(['followers' => $followers]);
    }

    /**
     * GET /users/{username}/following — список подписок
     */
    public function following($username) {
        $authUser = AuthMiddleware::getAuthUser();
        $currentUserId = $authUser ? $authUser['userId'] : null;

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $user = new User();
        $targetUser = $user->getByUsername($username);
        $following = $user->getFollowing($targetUser['id'], $limit, $offset, $currentUserId);

        $this->sendResponse(['following' => $following]);
    }
}
