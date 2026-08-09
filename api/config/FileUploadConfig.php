<?php

/**
 * Централизованная конфигурация для загрузки файлов
 * Определяет разрешенные типы, размеры и пути для каждого типа медиа
 */
class FileUploadConfig {

    // === ИЗОБРАЖЕНИЯ ===
    const IMAGE_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
    const IMAGE_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
    const IMAGE_MAX_SIZE = 5242880; // 5MB (5 * 1024 * 1024)

    // === GIF ===
    const GIF_ALLOWED_MIMES = ['image/gif'];
    const GIF_ALLOWED_EXTENSIONS = ['gif'];
    const GIF_MAX_SIZE = 10485760; // 10MB (10 * 1024 * 1024)

    // === ВИДЕО ===
    const VIDEO_ALLOWED_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg'];
    const VIDEO_ALLOWED_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mpeg'];
    const VIDEO_MAX_SIZE = 104857600; // 100MB (100 * 1024 * 1024)

    // === АВАТАРЫ ===
    const AVATAR_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const AVATAR_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const AVATAR_MAX_SIZE = 5242880; // 5MB

    /**
     * Получить абсолютный путь к директории загрузок
     * @param string $type Тип: 'posts', 'avatars', 'videos', 'gifs'
     * @param bool $createIfNotExists Создать директорию если не существует
     * @return string Абсолютный путь к директории
     */
    public static function getUploadDir($type, $createIfNotExists = true) {
        $baseDir = realpath(__DIR__ . '/../../uploads');

        $dirs = [
            'posts'   => $baseDir . '/posts/',
            'thumbs'  => $baseDir . '/posts/thumbs/',
            'avatars' => $baseDir . '/avatars/',
            'videos'  => $baseDir . '/videos/',
            'gifs'    => $baseDir . '/gifs/',
        ];

        $dir = $dirs[$type] ?? $baseDir . '/';

        if ($createIfNotExists && !is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        return $dir;
    }

    /**
     * Получить максимальный размер для типа медиа
     * @param string $type Тип: 'image', 'gif', 'video', 'avatar'
     * @return int Размер в байтах
     */
    public static function getMaxSize($type) {
        $sizes = [
            'image'  => self::IMAGE_MAX_SIZE,
            'gif'    => self::GIF_MAX_SIZE,
            'video'  => self::VIDEO_MAX_SIZE,
            'avatar' => self::AVATAR_MAX_SIZE,
        ];

        return $sizes[$type] ?? self::IMAGE_MAX_SIZE;
    }

    /**
     * Получить разрешенные MIME типы
     * @param string $type Тип: 'image', 'gif', 'video', 'avatar'
     * @return array Массив разрешенных MIME типов
     */
    public static function getAllowedMimes($type) {
        $mimes = [
            'image'  => self::IMAGE_ALLOWED_MIMES,
            'gif'    => self::GIF_ALLOWED_MIMES,
            'video'  => self::VIDEO_ALLOWED_MIMES,
            'avatar' => self::AVATAR_ALLOWED_MIMES,
        ];

        return $mimes[$type] ?? [];
    }

    /**
     * Получить разрешенные расширения
     * @param string $type Тип: 'image', 'gif', 'video', 'avatar'
     * @return array Массив разрешенных расширений
     */
    public static function getAllowedExtensions($type) {
        $extensions = [
            'image'  => self::IMAGE_ALLOWED_EXTENSIONS,
            'gif'    => self::GIF_ALLOWED_EXTENSIONS,
            'video'  => self::VIDEO_ALLOWED_EXTENSIONS,
            'avatar' => self::AVATAR_ALLOWED_EXTENSIONS,
        ];

        return $extensions[$type] ?? [];
    }

    /**
     * Генерирует безопасное имя файла
     * @param string $prefix Префикс (например, 'post_img', 'avatar')
     * @param string $extension Расширение без точки
     * @return string Имя файла
     */
    public static function generateFilename($prefix, $extension) {
        return $prefix . '_' . time() . '_' . uniqid() . '.' . $extension;
    }
}
