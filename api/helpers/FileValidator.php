<?php

/**
 * Валидатор файлов с проверкой magic bytes и реального содержимого
 */
class FileValidator {

    /**
     * Проверяет, что файл действительно является изображением
     * @param string $filePath Путь к файлу
     * @return bool
     */
    public static function isValidImage($filePath) {
        if (!file_exists($filePath)) {
            return false;
        }

        // Проверка через finfo (MIME type)
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $filePath);
        finfo_close($finfo);

        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!in_array($mimeType, $allowedMimes)) {
            return false;
        }

        // Дополнительная проверка: попытка загрузить изображение через GD
        // Если это не настоящая картинка - getimagesize вернет false
        $imageInfo = @getimagesize($filePath);
        if ($imageInfo === false) {
            return false;
        }

        // Проверка магических байтов (первые байты файла)
        $handle = fopen($filePath, 'rb');
        if (!$handle) {
            return false;
        }

        $bytes = fread($handle, 12);
        fclose($handle);

        // Магические байты популярных форматов
        $magicNumbers = [
            'jpeg' => ["\xFF\xD8\xFF"],
            'png'  => ["\x89\x50\x4E\x47\x0D\x0A\x1A\x0A"],
            'gif'  => ["\x47\x49\x46\x38\x37\x61", "\x47\x49\x46\x38\x39\x61"], // GIF87a, GIF89a
            'webp' => ["\x52\x49\x46\x46"], // RIFF....WEBP
        ];

        foreach ($magicNumbers as $format => $signatures) {
            foreach ($signatures as $signature) {
                if (strpos($bytes, $signature) === 0) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Проверяет, что файл действительно GIF
     * @param string $filePath Путь к файлу
     * @return bool
     */
    public static function isValidGif($filePath) {
        if (!file_exists($filePath)) {
            return false;
        }

        // Проверка MIME
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $filePath);
        finfo_close($finfo);

        if ($mimeType !== 'image/gif') {
            return false;
        }

        // Проверка магических байтов
        $handle = fopen($filePath, 'rb');
        if (!$handle) {
            return false;
        }

        $bytes = fread($handle, 6);
        fclose($handle);

        // GIF87a или GIF89a
        return $bytes === "GIF87a" || $bytes === "GIF89a";
    }

    /**
     * Проверяет видео через ffprobe
     * @param string $filePath Путь к файлу
     * @param string $ffprobePath Путь к ffprobe (по умолчанию 'ffprobe')
     * @return bool
     */
    public static function isValidVideo($filePath, $ffprobePath = 'ffprobe') {
        if (!file_exists($filePath)) {
            return false;
        }

        // Проверка наличия ffprobe
        exec('which ffprobe 2>&1', $whichOutput, $whichCode);
        if ($whichCode !== 0) {
            error_log("ffprobe not found in PATH");
            return false;
        }

        // Проверка через ffprobe
        $cmd = sprintf(
            '%s -v error -select_streams v:0 -show_entries stream=codec_type -of default=nw=1 %s 2>&1',
            escapeshellarg($ffprobePath),
            escapeshellarg($filePath)
        );

        exec($cmd, $output, $returnCode);

        return $returnCode === 0 && in_array('codec_type=video', $output);
    }

    /**
     * Универсальная валидация загруженного файла
     * @param array $file Массив $_FILES['field']
     * @param string $type Ожидаемый тип: 'image', 'gif', 'video'
     * @param int $maxSize Максимальный размер в байтах
     * @return array ['valid' => bool, 'error' => string|null]
     */
    public static function validate($file, $type, $maxSize) {
        // Проверка на ошибки загрузки
        if (!isset($file['tmp_name']) || $file['error'] !== UPLOAD_ERR_OK) {
            return ['valid' => false, 'error' => 'File upload error'];
        }

        // Проверка размера
        if ($file['size'] > $maxSize) {
            $maxMB = round($maxSize / (1024 * 1024), 1);
            return ['valid' => false, 'error' => "File too large (max {$maxMB}MB)"];
        }

        // Проверка типа файла
        switch ($type) {
            case 'image':
                if (!self::isValidImage($file['tmp_name'])) {
                    return ['valid' => false, 'error' => 'Invalid image file'];
                }
                break;

            case 'gif':
                if (!self::isValidGif($file['tmp_name'])) {
                    return ['valid' => false, 'error' => 'Invalid GIF file'];
                }
                break;

            case 'video':
                if (!self::isValidVideo($file['tmp_name'])) {
                    return ['valid' => false, 'error' => 'Invalid video file'];
                }
                break;

            default:
                return ['valid' => false, 'error' => 'Unknown file type'];
        }

        return ['valid' => true, 'error' => null];
    }
}
