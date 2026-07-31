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

        $post = new Post();
        $postId = $post->create($authUser['userId'], $input['content'] ?? '');

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

    // 404 — роут не найден
    sendError('Endpoint not found', 404);

} catch (Exception $e) {
    sendError($e->getMessage(), 500);
}
