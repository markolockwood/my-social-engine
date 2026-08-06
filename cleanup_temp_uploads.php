#!/usr/bin/env php
<?php
/**
 * Cron-скрипт для очистки временных загрузок старше 6 часов
 * Запускать: php cleanup_temp_uploads.php
 * Или в crontab: 0 */3 * * * php /path/to/cleanup_temp_uploads.php
 */

require_once __DIR__ . '/api/classes/Database.php';

$db = Database::getInstance();

try {
    // 1. Удаляем файлы помеченные для удаления (deleted_at IS NOT NULL)
    $markedForDeletion = $db->query(
        "SELECT id, file_path, media_type FROM temp_uploads WHERE deleted_at IS NOT NULL"
    );

    $basePath = realpath(__DIR__);
    $deleted = 0;

    foreach ($markedForDeletion as $upload) {
        $path = $upload['file_path'];
        $mediaType = $upload['media_type'];

        if ($mediaType === 'video') {
            $dir = $basePath . '/uploads/videos/' . $path;
            if (is_dir($dir)) {
                deleteDirectory($dir);
                echo "Deleted marked video directory: {$dir}\n";
                $deleted++;
            }
        } else {
            if (strpos($path, '/') === 0) {
                $fullPath = $basePath . $path;
                if (file_exists($fullPath)) {
                    unlink($fullPath);
                    echo "Deleted marked file: {$fullPath}\n";
                    $deleted++;
                }
            }
        }

        $db->query("DELETE FROM temp_uploads WHERE id = ?", [$upload['id']]);
    }

    // 2. Получаем записи старше 6 часов
    $cutoff = date('Y-m-d H:i:s', strtotime('-6 hours'));
    $result = $db->query(
        "SELECT id, file_path, media_type FROM temp_uploads WHERE created_at < ?",
        [$cutoff]
    );
    $oldUploads = $result->fetchAll();

    foreach ($oldUploads as $upload) {
        $filePath = $upload['file_path'];
        $mediaType = $upload['media_type'];

        if ($mediaType === 'video') {
            if (preg_match('/^[a-f0-9]+$/', $filePath)) {
                $dir = $basePath . '/uploads/videos/' . $filePath;
                if (is_dir($dir)) {
                    deleteDirectory($dir);
                    echo "Deleted old video directory: {$dir}\n";
                    $deleted++;
                }
            } elseif (preg_match('#^/uploads/videos/([a-f0-9]+)/master\.m3u8$#', $filePath, $m)) {
                $dir = $basePath . '/uploads/videos/' . $m[1];
                if (is_dir($dir)) {
                    deleteDirectory($dir);
                    echo "Deleted old HLS directory: {$dir}\n";
                    $deleted++;
                }
            }
        } else {
            $fullPath = $basePath . $filePath;
            if (file_exists($fullPath)) {
                unlink($fullPath);
                echo "Deleted file: {$fullPath}\n";
                $deleted++;
            }

            if ($upload['media_type'] === 'image' && strpos($filePath, '/uploads/posts/') === 0) {
                $thumbPath = $basePath . '/uploads/posts/thumbs/' . basename($filePath);
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
        $path = $dir . '/' . $item;
        is_dir($path) ? deleteDirectory($path) : unlink($path);
    }
    rmdir($dir);
}
