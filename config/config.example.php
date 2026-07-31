<?php
// Скопируйте этот файл в config.php и настройте параметры

return [
    'database' => [
        'host' => 'localhost',
        'port' => '5432',
        'dbname' => 'mytwit',
        'username' => 'postgres',
        'password' => 'your_password_here', // ИЗМЕНИТЕ НА ВАШ ПАРОЛЬ
        'charset' => 'utf8'
    ],
    'jwt' => [
        'secret' => 'your_jwt_secret_key_change_this_in_production', // ИЗМЕНИТЕ В ПРОДАКШЕНЕ
        'expiration' => 86400 * 7 // 7 дней
    ],
    'app' => [
        'url' => 'http://mytwit.com',
        'api_prefix' => '/api'
    ]
];
