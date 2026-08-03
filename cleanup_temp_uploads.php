#!/usr/bin/env php
<?php
/**
 * Cron-скрипт для очистки временных загрузок старше 48 часов
 * Запускать: php cleanup_temp_uploads.php
 * Или в crontab: 0 3 * * * php /path/to/cleanup_temp_uploads.php
 */

require_once __DIR__ . '/api/classes/Database.php';

$db = Database::getInstance();

try {
    // Получаем записи старше 48 часов
    $cutoff = date('Y-m-d H:i:s', strtotime('-48 hours'));
    $result = $db->query(
        "SELECT id, file_path, media_type FROM temp_uploads WHERE created_at < ?",
        [$cutoff]
    );
    $oldUploads = $result->fetchAll();

    $basePath = realpath(__DIR__);
    $deleted = 0;

    foreach ($oldUploads as $upload) {
        $filePath = $upload['file_path'];

        // HLS-видео: удалить директорию
        if (preg_match('#^/uploads/videos/([a-f0-9]+)/master\.m3u8$#', $filePath, $m)) {
            $dir = $basePath . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR
                             . 'videos'  . DIRECTORY_SEPARATOR . $m[1];
            if (is_dir($dir)) {
                deleteDirectory($dir);
                echo "Deleted HLS directory: {$dir}\n";
                $deleted++;
            }
        } else {
            // Одиночный файл
            $fullPath = $basePath . DIRECTORY_SEPARATOR . ltrim(str_replace('/', DIRECTORY_SEPARATOR, $filePath), DIRECTORY_SEPARATOR);
            if (file_exists($fullPath)) {
                unlink($fullPath);
                echo "Deleted file: {$fullPath}\n";
                $deleted++;
            }

            // Миниатюра для изображений
            if ($upload['media_type'] === 'image' && strpos($filePath, '/uploads/posts/') === 0) {
                $thumbPath = $basePath . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR
                                       . 'posts'   . DIRECTORY_SEPARATOR . 'thumbs' . DIRECTORY_SEPARATOR
                                       . basename($filePath);
                if (file_exists($thumbPath)) {
                    unlink($thumbPath);
                    echo "Deleted thumb: {$thumbPath}\n";
                }
            }
        }

        // Удаляем запись из БД
        $db->query("DELETE FROM temp_uploads WHERE id = ?", [$upload['id']]);
    }

    echo "Cleanup complete. Deleted {$deleted} old uploads.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

function deleteDirectory($dir) {
    if (!is_dir($dir)) return;
    foreach (array_diff(scandir($dir), ['.', '..']) as $item) {
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        is_dir($path) ? deleteDirectory($path) : unlink($path);
    }
    rmdir($dir);
}
