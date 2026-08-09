<?php

require_once __DIR__ . '/../classes/Database.php';

/**
 * Helper для работы с временными загрузками (temp_uploads)
 * Устраняет дублирование логики блокировок, проверок лимитов и регистрации файлов
 */
class TempUploadsHelper {

    /**
     * Проверяет лимит загрузок и захватывает блокировку
     * @param int $userId ID пользователя
     * @param int $requiredSlots Сколько слотов нужно (по умолчанию 1)
     * @param int $maxLimit Максимальный лимит (по умолчанию 4)
     * @throws Exception Если лимит превышен
     */
    public static function checkLimitAndLock($userId, $requiredSlots = 1, $maxLimit = 4) {
        $db = Database::getInstance();

        // Захватываем session-level advisory lock
        $db->query("SELECT pg_advisory_lock(?)", [$userId]);

        try {
            // Проверяем текущее количество загрузок
            $stmt = $db->query(
                "SELECT COUNT(*) as cnt FROM temp_uploads WHERE user_id = ?",
                [$userId]
            );
            $count = (int)$stmt->fetch()['cnt'];

            if ($count + $requiredSlots > $maxLimit) {
                // Снимаем блокировку перед выходом
                self::releaseLock($userId);
                throw new Exception('Достигнут лимит 4 медиа. Удалите старые файлы перед загрузкой новых.');
            }

            // Лимит не превышен, блокировка остается активной
            // Caller должен вызвать releaseLock() после регистрации файлов

        } catch (Exception $e) {
            // При любой ошибке снимаем блокировку
            self::releaseLock($userId);
            throw $e;
        }
    }

    /**
     * Снимает advisory lock для пользователя
     * @param int $userId ID пользователя
     */
    public static function releaseLock($userId) {
        try {
            $db = Database::getInstance();
            $db->query("SELECT pg_advisory_unlock(?)", [$userId]);
        } catch (Exception $e) {
            error_log("Failed to release advisory lock for user {$userId}: " . $e->getMessage());
        }
    }

    /**
     * Регистрирует загруженный файл в temp_uploads
     * @param int $userId ID пользователя
     * @param string $filePath Путь к файлу
     * @param string $mediaType Тип медиа: 'image', 'gif', 'video'
     * @param string|null $trackingId ID для группировки файлов
     * @param int|null $processPid PID процесса конвертации (для видео)
     * @return bool Успешно ли зарегистрирован
     */
    public static function register($userId, $filePath, $mediaType, $trackingId = null, $processPid = null) {
        try {
            $db = Database::getInstance();
            $db->query(
                "INSERT INTO temp_uploads (user_id, file_path, media_type, tracking_id, process_pid)
                 VALUES (?, ?, ?, ?, ?)",
                [$userId, $filePath, $mediaType, $trackingId, $processPid]
            );
            return true;
        } catch (Exception $e) {
            error_log("Failed to register temp upload: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Удаляет записи из temp_uploads
     * @param int $userId ID пользователя
     * @param string|null $filePath Путь к файлу (опционально)
     * @param string|null $trackingId Tracking ID (опционально)
     * @return int Количество удаленных записей
     */
    public static function remove($userId, $filePath = null, $trackingId = null) {
        try {
            $db = Database::getInstance();

            if ($trackingId) {
                // Удаление по tracking ID
                $stmt = $db->query(
                    "DELETE FROM temp_uploads WHERE user_id = ? AND tracking_id = ?",
                    [$userId, $trackingId]
                );
            } elseif ($filePath) {
                // Удаление по пути к файлу
                $stmt = $db->query(
                    "DELETE FROM temp_uploads WHERE user_id = ? AND file_path = ?",
                    [$userId, $filePath]
                );
            } else {
                // Удаление всех записей пользователя
                $stmt = $db->query(
                    "DELETE FROM temp_uploads WHERE user_id = ?",
                    [$userId]
                );
            }

            return $stmt->rowCount();

        } catch (Exception $e) {
            error_log("Failed to remove from temp_uploads: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Получает записи из temp_uploads с RETURNING для последующего удаления
     * @param int $userId ID пользователя
     * @param string|null $filePath Путь к файлу
     * @param string|null $trackingId Tracking ID
     * @return array|false Массив записей или false при ошибке
     */
    public static function getAndRemove($userId, $filePath = null, $trackingId = null) {
        try {
            $db = Database::getInstance();

            if ($trackingId) {
                $stmt = $db->query(
                    "DELETE FROM temp_uploads
                     WHERE user_id = ? AND tracking_id = ?
                     RETURNING file_path, media_type, process_pid",
                    [$userId, $trackingId]
                );
            } elseif ($filePath) {
                $stmt = $db->query(
                    "DELETE FROM temp_uploads
                     WHERE user_id = ? AND file_path = ?
                     RETURNING file_path, media_type, process_pid",
                    [$userId, $filePath]
                );
            } else {
                return false;
            }

            return $stmt->fetchAll();

        } catch (Exception $e) {
            error_log("Failed to get and remove from temp_uploads: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Обновляет PID процесса для записи
     * @param int $userId ID пользователя
     * @param string $trackingId Tracking ID
     * @param int $processPid PID процесса
     * @return bool Успешно ли обновлен
     */
    public static function updateProcessPid($userId, $trackingId, $processPid) {
        try {
            $db = Database::getInstance();
            $db->query(
                "UPDATE temp_uploads SET process_pid = ? WHERE tracking_id = ? AND user_id = ?",
                [$processPid, $trackingId, $userId]
            );
            return true;
        } catch (Exception $e) {
            error_log("Failed to update process PID: " . $e->getMessage());
            return false;
        }
    }
}
