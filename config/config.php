<?php
// Загрузка переменных окружения из .env файла
if (!function_exists('loadEnv')) {
    function loadEnv($path) {
        if (!file_exists($path)) {
            return;
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            // Пропускаем комментарии
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            // Парсим KEY=VALUE
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                // Устанавливаем в $_ENV если ещё не установлено
                if (!isset($_ENV[$key])) {
                    $_ENV[$key] = $value;
                }
            }
        }
    }
}

// Загружаем .env из корня проекта (только один раз)
if (!isset($_ENV['JWT_SECRET'])) {
    loadEnv(__DIR__ . '/../.env');
}

return [
    'database' => [
        'host' => 'localhost',
        'port' => '5432',
        'dbname' => 'mytwit',
        'username' => 'mytwit',
        'password' => 'mytwit',
        'charset' => 'utf8'
    ],
    'jwt' => [
        'secret' => $_ENV['JWT_SECRET'] ?? 'your_jwt_secret_key_change_this_in_production',
        'expiration' => 900 // 15 минут (access token)
    ],
    'app' => [
        'url' => $_ENV['APP_URL'] ?? 'http://mytwit.com',
        'api_prefix' => '/api',
        'environment' => $_ENV['APP_ENV'] ?? 'development'
    ],
    'cors' => [
        'allowed_origins' => isset($_ENV['CORS_ALLOWED_ORIGINS'])
            ? explode(',', $_ENV['CORS_ALLOWED_ORIGINS'])
            : ['http://mytwit.com']
    ],
    'ffmpeg' => [
        'binary' => '/usr/bin/ffmpeg',
        'ffprobe' => '/usr/bin/ffprobe'
    ],
    'redis' => [
        'host' => '127.0.0.1',
        'port' => 6379,
        'timeout' => 1.0 // секунд на подключение
    ]
];
