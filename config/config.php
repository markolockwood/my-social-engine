<?php
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
        'secret' => 'your_jwt_secret_key_change_this_in_production',
        'expiration' => 86400 * 7 // 7 дней
    ],
    'app' => [
        'url' => 'http://mytwit.com',
        'api_prefix' => '/api',
        'environment' => 'development' // development или production
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
