<?php

// CORS-заголовки для работы SPA
header('Content-Type: application/json');

// Загружаем конфигурацию для получения разрешённых доменов
$config = require __DIR__ . '/../config/config.php';
$allowedOrigins = $config['cors']['allowed_origins'];

// Получаем origin запроса
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Проверяем, разрешён ли этот origin
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: {$origin}");
} else {
    // В development режиме разрешаем localhost для удобства разработки
    if ($config['app']['environment'] === 'development' &&
        (strpos($origin, 'http://localhost:') === 0 || strpos($origin, 'http://127.0.0.1:') === 0)) {
        header("Access-Control-Allow-Origin: {$origin}");
    }
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Preflight-запросы (OPTIONS) завершаем сразу
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Подключение зависимостей
require_once __DIR__ . '/Router.php';
require_once __DIR__ . '/middleware/CsrfMiddleware.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/PostController.php';
require_once __DIR__ . '/controllers/UserController.php';

// CSRF защита для всех state-changing запросов
CsrfMiddleware::verify();

// Инициализация роутера
$router = new Router();

// Парсинг пути запроса
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];
$path = preg_replace('#^/api#', '', parse_url($requestUri, PHP_URL_PATH));

try {
    // === AUTH ROUTES ===
    $router->post('/auth/register', 'AuthController', 'register');
    $router->post('/auth/login', 'AuthController', 'login');
    $router->get('/auth/me', 'AuthController', 'me');
    $router->post('/auth/refresh', 'AuthController', 'refresh');
    $router->post('/auth/logout', 'AuthController', 'logout');
    $router->post('/auth/logout-all', 'AuthController', 'logoutAll');

    // === POST ROUTES ===
    $router->get('/posts', 'PostController', 'index');
    $router->post('/posts', 'PostController', 'create');
    $router->get('/posts/{id}', 'PostController', 'show');
    $router->delete('/posts/{id}', 'PostController', 'delete');
    $router->post('/posts/{id}/like', 'PostController', 'like');
    $router->post('/posts/{id}/unlike', 'PostController', 'unlike');
    $router->get('/posts/{id}/replies', 'PostController', 'replies');
    $router->get('/posts/{id}/counters', 'PostController', 'counters');
    $router->post('/posts/{id}/view', 'PostController', 'view');
    $router->get('/posts/{id}/comments', 'PostController', 'getComments');
    $router->post('/posts/{id}/comments', 'PostController', 'addComment');
    $router->delete('/comments/{id}', 'PostController', 'deleteComment');
    $router->post('/upload/post-images', 'PostController', 'uploadPostImages');
    $router->post('/upload/post-gif', 'PostController', 'uploadPostGif');
    $router->post('/upload/post-video', 'PostController', 'uploadPostVideo');
    $router->delete('/upload/media', 'PostController', 'deleteUploadedMedia');
    $router->delete('/upload/cancel', 'PostController', 'cancelUpload');
    $router->get('/temp-uploads', 'PostController', 'getTempUploads');

    // === USER ROUTES ===
    $router->get('/users/{username}', 'UserController', 'profile');
    $router->get('/users/{username}/posts', 'UserController', 'posts');
    $router->get('/users/{username}/replies', 'UserController', 'replies');
    $router->post('/users/{username}/follow', 'UserController', 'follow');
    $router->delete('/users/{username}/follow', 'UserController', 'unfollow');
    $router->get('/users/{username}/followers', 'UserController', 'followers');
    $router->get('/users/{username}/following', 'UserController', 'following');
    $router->patch('/user/theme', 'UserController', 'updateTheme');
    $router->patch('/user/language', 'UserController', 'updateLanguage');
    $router->patch('/user/profile', 'UserController', 'updateProfile');
    $router->patch('/user/video-volume', 'UserController', 'updateVideoVolume');
    $router->patch('/user/protected-posts', 'UserController', 'updateProtectedPosts');
    $router->get('/user/account-info', 'UserController', 'getAccountInfo');
    $router->patch('/user/username', 'UserController', 'updateUsername');
    $router->patch('/user/country', 'UserController', 'updateCountry');
    $router->patch('/user/gender', 'UserController', 'updateGender');
    $router->post('/upload/avatar', 'UserController', 'uploadAvatar');
    $router->get('/user/follow-requests', 'UserController', 'getFollowRequests');
    $router->get('/user/follow-requests/count', 'UserController', 'getFollowRequestsCount');
    $router->post('/user/follow-requests/{username}/accept', 'UserController', 'acceptFollowRequest');
    $router->post('/user/follow-requests/{username}/decline', 'UserController', 'declineFollowRequest');
    $router->delete('/user/follow-requests/{username}', 'UserController', 'cancelFollowRequest');

    // Запуск роутера
    $router->dispatch($requestMethod, $path);

} catch (Exception $e) {
    // Обработка ошибок
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
