<?php

// CORS-заголовки для работы SPA
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Preflight-запросы (OPTIONS) завершаем сразу
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/classes/Database.php';
require_once __DIR__ . '/classes/User.php';
require_once __DIR__ . '/classes/Post.php';
require_once __DIR__ . '/classes/JWT.php';

function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

function sendError($message, $statusCode = 400) {
    http_response_code($statusCode);
    echo json_encode(['error' => $message]);
    exit();
}

// Извлекает Bearer-токен из заголовка Authorization. Fallback на $_SERVER если getallheaders() не работает
function getAuthUser() {
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

// Проверяет наличие токена. Возвращает payload или завершает запрос с 401
function requireAuth() {
    $user = getAuthUser();

    if (!$user) {
        sendError('Unauthorized', 401);
    }

    return $user;
}

// Парсинг пути и тела запроса
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

$path = preg_replace('#^/api#', '', parse_url($requestUri, PHP_URL_PATH));
$input = json_decode(file_get_contents('php://input'), true);

try {
    // === AUTH ROUTES ===

    // POST /auth/register — регистрация нового пользователя
    if ($path === '/auth/register' && $requestMethod === 'POST') {
        $user = new User();
        $userId = $user->register(
            $input['username'] ?? '',
            $input['email'] ?? '',
            $input['password'] ?? '',
            $input['displayName'] ?? ''
        );

        $userData = $user->getById($userId);
        $token = JWT::encode(['userId' => $userId, 'username' => $userData['username']]);

        sendResponse([
            'token' => $token,
            'user' => $userData
        ], 201);
    }

    // POST /auth/login — вход по логину/паролю
    if ($path === '/auth/login' && $requestMethod === 'POST') {
        $user = new User();
        $userData = $user->login(
            $input['username'] ?? '',
            $input['password'] ?? ''
        );

        $token = JWT::encode(['userId' => $userData['id'], 'username' => $userData['username']]);

        sendResponse([
            'token' => $token,
            'user' => $userData
        ]);
    }

    // GET /auth/me — возвращает данные текущего пользователя (требует авторизацию)
    if ($path === '/auth/me' && $requestMethod === 'GET') {
        $authUser = requireAuth();
        $user = new User();
        $userData = $user->getById($authUser['userId']);

        sendResponse(['user' => $userData]);
    }

    // === POST ROUTES ===

    // GET /posts — лента постов (с пагинацией)
    if ($path === '/posts' && $requestMethod === 'GET') {
        $authUser = getAuthUser();
        $userId = $authUser ? $authUser['userId'] : null;

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $post = new Post();
        $posts = $post->getFeed($userId, $limit, $offset);

        sendResponse(['posts' => $posts]);
    }

    // POST /posts — создание нового поста (требует авторизацию)
    if ($path === '/posts' && $requestMethod === 'POST') {
        $authUser = requireAuth();

        $parentId = isset($input['parent_id']) ? (int)$input['parent_id'] : null;
        $isQuickReply = isset($input['is_quick_reply']) && $input['is_quick_reply'] ? true : false;

        $post = new Post();
        $postId = $post->create($authUser['userId'], $input['content'] ?? '', $parentId, $isQuickReply);

        $postData = $post->getById($postId, $authUser['userId']);

        sendResponse(['post' => $postData], 201);
    }

    // GET /posts/{id} — получение одного поста
    if (preg_match('#^/posts/(\d+)$#', $path, $matches) && $requestMethod === 'GET') {
        $postId = $matches[1];
        $authUser = getAuthUser();
        $userId = $authUser ? $authUser['userId'] : null;

        $post = new Post();
        $postData = $post->getById($postId, $userId);

        sendResponse(['post' => $postData]);
    }

    // DELETE /posts/{id} — удаление поста (требует авторизацию + владение постом)
    if (preg_match('#^/posts/(\d+)$#', $path, $matches) && $requestMethod === 'DELETE') {
        $postId = $matches[1];
        $authUser = requireAuth();

        $post = new Post();
        $post->delete($postId, $authUser['userId']);

        sendResponse(['message' => 'Post deleted successfully']);
    }

    // POST /posts/{id}/like — поставить лайк (требует авторизацию)
    if (preg_match('#^/posts/(\d+)/like$#', $path, $matches) && $requestMethod === 'POST') {
        $postId = $matches[1];
        $authUser = requireAuth();

        $post = new Post();
        $post->like($postId, $authUser['userId']);

        sendResponse(['message' => 'Post liked successfully']);
    }

    // POST /posts/{id}/unlike — убрать лайк (требует авторизацию)
    if (preg_match('#^/posts/(\d+)/unlike$#', $path, $matches) && $requestMethod === 'POST') {
        $postId = $matches[1];
        $authUser = requireAuth();

        $post = new Post();
        $post->unlike($postId, $authUser['userId']);

        sendResponse(['message' => 'Post unliked successfully']);
    }

    // GET /posts/{id}/replies — ответы на пост (вложенные посты)
    if (preg_match('#^/posts/(\d+)/replies$#', $path, $matches) && $requestMethod === 'GET') {
        $postId = $matches[1];
        $authUser = getAuthUser();
        $userId = $authUser ? $authUser['userId'] : null;

        $post = new Post();
        $replies = $post->getReplies($postId, $userId);

        sendResponse(['posts' => $replies]);
    }

    // POST /posts/{id}/retweet — ретвит (требует авторизацию)
    if (preg_match('#^/posts/(\d+)/retweet$#', $path, $matches) && $requestMethod === 'POST') {
        $postId = $matches[1];
        $authUser = requireAuth();

        $post = new Post();
        $post->retweet($postId, $authUser['userId']);

        sendResponse(['message' => 'Post retweeted successfully']);
    }

    // POST /posts/{id}/unretweet — убрать ретвит (требует авторизацию)
    if (preg_match('#^/posts/(\d+)/unretweet$#', $path, $matches) && $requestMethod === 'POST') {
        $postId = $matches[1];
        $authUser = requireAuth();

        $post = new Post();
        $post->unretweet($postId, $authUser['userId']);

        sendResponse(['message' => 'Post unretweeted successfully']);
    }

    // GET /posts/{id}/comments — список комментариев к посту
    if (preg_match('#^/posts/(\d+)/comments$#', $path, $matches) && $requestMethod === 'GET') {
        $postId = $matches[1];

        $post = new Post();
        $comments = $post->getComments($postId);

        sendResponse(['comments' => $comments]);
    }

    // POST /posts/{id}/comments — добавить комментарий (требует авторизацию)
    if (preg_match('#^/posts/(\d+)/comments$#', $path, $matches) && $requestMethod === 'POST') {
        $postId = $matches[1];
        $authUser = requireAuth();

        $post = new Post();
        $commentId = $post->addComment($authUser['userId'], $postId, $input['content'] ?? '');

        $comments = $post->getComments($postId);
        $newComment = array_values(array_filter($comments, fn($c) => $c['id'] == $commentId))[0];

        sendResponse(['comment' => $newComment], 201);
    }

    // DELETE /comments/{id} — удалить комментарий (требует авторизацию)
    if (preg_match('#^/comments/(\d+)$#', $path, $matches) && $requestMethod === 'DELETE') {
        $commentId = $matches[1];
        $authUser = requireAuth();

        $post = new Post();
        $post->deleteComment($commentId, $authUser['userId']);

        sendResponse(['message' => 'Comment deleted successfully']);
    }

    // === USER ROUTES ===

    // GET /users/{username} — профиль пользователя по username
    if (preg_match('#^/users/([^/]+)$#', $path, $matches) && $requestMethod === 'GET') {
        $username = $matches[1];

        $user = new User();
        $userData = $user->getByUsername($username);

        sendResponse(['user' => $userData]);
    }

    // GET /users/{username}/posts — все посты пользователя
    if (preg_match('#^/users/([^/]+)/posts$#', $path, $matches) && $requestMethod === 'GET') {
        $username = $matches[1];
        $authUser = getAuthUser();
        $currentUserId = $authUser ? $authUser['userId'] : null;

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $user = new User();
        $userData = $user->getByUsername($username);

        $post = new Post();
        $posts = $post->getByUserId($userData['id'], $limit, $offset, $currentUserId);

        sendResponse(['posts' => $posts]);
    }

    // GET /users/{username}/replies — ответы пользователя (посты с parent_id)
    if (preg_match('#^/users/([^/]+)/replies$#', $path, $matches) && $requestMethod === 'GET') {
        $username = $matches[1];
        $authUser = getAuthUser();
        $currentUserId = $authUser ? $authUser['userId'] : null;

        $limit  = isset($_GET['limit'])  ? (int)$_GET['limit']  : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $user = new User();
        $userData = $user->getByUsername($username);

        $post = new Post();
        $replies = $post->getRepliesByUser($userData['id'], $currentUserId, $limit, $offset);

        sendResponse(['replies' => $replies]);
    }

    // PATCH /user/theme — сохраняет предпочтение темы пользователя
    if ($path === '/user/theme' && $requestMethod === 'PATCH') {
        $authUser = requireAuth();
        $user = new User();
        $user->updateTheme($authUser['userId'], $input['theme'] ?? '');

        sendResponse(['theme' => $input['theme']]);
    }

    // PATCH /user/language — сохраняет предпочтение языка пользователя
    if ($path === '/user/language' && $requestMethod === 'PATCH') {
        $authUser = requireAuth();
        $user = new User();
        $user->updateLanguage($authUser['userId'], $input['language'] ?? '');

        sendResponse(['language' => $input['language']]);
    }

    // PATCH /user/profile — обновление профиля (имя, bio, локация, дата рождения, аватар)
    if ($path === '/user/profile' && $requestMethod === 'PATCH') {
        $authUser = requireAuth();
        $user = new User();

        $allowed = ['display_name', 'bio', 'location', 'birth_date', 'avatar_url'];
        $data = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $input)) {
                $data[$field] = $input[$field] === '' ? null : $input[$field];
            }
        }

        if (isset($data['display_name']) && (strlen($data['display_name']) < 1 || strlen($data['display_name']) > 100)) {
            sendError('Display name must be between 1 and 100 characters');
        }

        $user->updateProfile($authUser['userId'], $data);
        $userData = $user->getById($authUser['userId']);

        sendResponse(['user' => $userData]);
    }

    // POST /upload/avatar — загрузка аватара
    if ($path === '/upload/avatar' && $requestMethod === 'POST') {
        $authUser = requireAuth();

        if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
            sendError('No file uploaded');
        }

        $file = $_FILES['avatar'];
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        if (!in_array($file['type'], $allowedTypes)) {
            sendError('Invalid file type. Allowed: JPEG, PNG, GIF, WEBP');
        }

        if ($file['size'] > 5 * 1024 * 1024) {
            sendError('File too large (max 5MB)');
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $filename = 'avatar_' . $authUser['userId'] . '_' . time() . '.' . $ext;
        $uploadDir = __DIR__ . '/../uploads/avatars/';

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
            sendError('Failed to save file');
        }

        sendResponse(['url' => '/uploads/avatars/' . $filename], 201);
    }

    // 404 — роут не найден
    sendError('Endpoint not found', 404);

} catch (Exception $e) {
    sendError($e->getMessage(), 500);
}
