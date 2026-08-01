<?php

// CORS-заголовки для работы SPA
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Preflight-запросы (OPTIONS) завершаем сразу
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Подключение зависимостей
require_once __DIR__ . '/Router.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/PostController.php';
require_once __DIR__ . '/controllers/UserController.php';

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

    // === POST ROUTES ===
    $router->get('/posts', 'PostController', 'index');
    $router->post('/posts', 'PostController', 'create');
    $router->get('/posts/{id}', 'PostController', 'show');
    $router->delete('/posts/{id}', 'PostController', 'delete');
    $router->post('/posts/{id}/like', 'PostController', 'like');
    $router->post('/posts/{id}/unlike', 'PostController', 'unlike');
    $router->get('/posts/{id}/replies', 'PostController', 'replies');
    $router->post('/posts/{id}/view', 'PostController', 'view');
    $router->get('/posts/{id}/comments', 'PostController', 'getComments');
    $router->post('/posts/{id}/comments', 'PostController', 'addComment');
    $router->delete('/comments/{id}', 'PostController', 'deleteComment');
    $router->post('/upload/post-images', 'PostController', 'uploadPostImages');

    // === USER ROUTES ===
    $router->get('/users/{username}', 'UserController', 'profile');
    $router->get('/users/{username}/posts', 'UserController', 'posts');
    $router->get('/users/{username}/replies', 'UserController', 'replies');
    $router->patch('/user/theme', 'UserController', 'updateTheme');
    $router->patch('/user/language', 'UserController', 'updateLanguage');
    $router->patch('/user/profile', 'UserController', 'updateProfile');
    $router->post('/upload/avatar', 'UserController', 'uploadAvatar');

    // Запуск роутера
    $router->dispatch($requestMethod, $path);

} catch (Exception $e) {
    // Обработка ошибок
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
