<?php

// Ручная реализация JWT (HS256). Не использует сторонние библиотеки.
class JWT {
    private static $secret;

    // Загружает секрет из конфига — вызывается перед каждой операцией
    public static function init() {
        $config = require __DIR__ . '/../../config/config.php';
        self::$secret = $config['jwt']['secret'];
    }

    // Создаёт токен: кодирует header + payload, добавляет HMAC-подпись
    public static function encode($payload) {
        self::init();

        $config = require __DIR__ . '/../../config/config.php';
        $expiration = $config['jwt']['expiration'];

        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload['exp'] = time() + $expiration;
        $payload = json_encode($payload);

        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode($payload);

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::$secret, true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    // Проверяет подпись и срок действия токена, возвращает payload
    public static function decode($jwt) {
        self::init();

        $tokenParts = explode('.', $jwt);

        if (count($tokenParts) !== 3) {
            throw new Exception("Invalid token format");
        }

        [$headerB64, $payloadB64, $signatureProvided] = $tokenParts;

        // Подпись считается по оригинальным base64url-частям, а не по декодированным значениям
        $signature = hash_hmac('sha256', $headerB64 . "." . $payloadB64, self::$secret, true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        if ($base64UrlSignature !== $signatureProvided) {
            throw new Exception("Invalid token signature");
        }

        $payload = json_decode(self::base64UrlDecode($payloadB64), true);

        if (!isset($payload['exp']) || $payload['exp'] < time()) {
            throw new Exception("Token has expired");
        }

        return $payload;
    }

    // base64 → base64url: заменяет +/= на -_
    private static function base64UrlEncode($text) {
        return str_replace(
            ['+', '/', '='],
            ['-', '_', ''],
            base64_encode($text)
        );
    }

    // base64url → base64: обратная замена + восстановление padding
    private static function base64UrlDecode($text) {
        $remainder = strlen($text) % 4;
        if ($remainder) {
            $text .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(str_replace(['-', '_'], ['+', '/'], $text));
    }
}
