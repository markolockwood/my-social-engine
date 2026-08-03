<?php

class Post {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    /**
     * Базовый SELECT для постов с подсчётами и подзапросами
     * @param bool $withUserId - если true, добавляет is_liked для конкретного пользователя
     * @return string SQL фрагмент SELECT
     */
    private function baseSelect($withUserId = false) {
        $sql = "SELECT
                    p.id,
                    p.content,
                    p.created_at,
                    p.parent_id,
                    p.is_quick_reply,
                    p.views_count,
                    u.id as user_id,
                    u.username,
                    u.display_name,
                    u.avatar_url,
                    (SELECT username FROM posts parent JOIN users pu ON parent.user_id = pu.id WHERE parent.id = p.parent_id) as parent_username,
                    (SELECT COUNT(*) FROM likes    WHERE post_id = p.id) as likes_count,
                    (SELECT COUNT(*) FROM posts    WHERE parent_id = p.id) as comments_count";

        if ($withUserId) {
            $sql .= ",
                    (SELECT COUNT(*) > 0 FROM likes    WHERE post_id = p.id AND user_id = ?) as is_liked";
        }
        return $sql;
    }

    /**
     * Получить медиафайлы для постов
     * @param array $posts - массив постов
     * @return array Посты с добавленным полем media
     */
    private function attachMedia($posts) {
        if (empty($posts)) return $posts;

        $postIds = array_column($posts, 'id');
        if (empty($postIds)) return $posts;

        $placeholders = implode(',', array_fill(0, count($postIds), '?'));

        $sql = "SELECT post_id, media_url, media_type, display_order, thumb_url
                FROM post_media
                WHERE post_id IN ($placeholders)
                ORDER BY post_id, display_order";

        try {
            $mediaFiles = $this->db->query($sql, $postIds)->fetchAll();
        } catch (Exception $e) {
            foreach ($posts as &$post) {
                $post['media'] = '[]';
            }
            return $posts;
        }

        $mediaByPost = [];
        foreach ($mediaFiles as $media) {
            if (!isset($mediaByPost[$media['post_id']])) {
                $mediaByPost[$media['post_id']] = [];
            }
            $mediaByPost[$media['post_id']][] = [
                'url' => $media['media_url'],
                'thumb' => $media['thumb_url'],
                'type' => $media['media_type'],
                'order' => (int)$media['display_order']
            ];
        }

        foreach ($posts as &$post) {
            $post['media'] = isset($mediaByPost[$post['id']])
                ? json_encode($mediaByPost[$post['id']])
                : '[]';
        }

        return $posts;
    }

    /**
     * Создание нового поста или ответа
     * @param int $userId - ID автора
     * @param string $content - Текст поста (макс. 280 символов)
     * @param int|null $parentId - ID родительского поста (для ответов)
     * @param bool $isQuickReply - TRUE = быстрый ответ с цитатой, FALSE = thread reply
     * @param array $mediaFiles - Массив медиафайлов [['url' => '...', 'type' => 'image|gif|video'], ...] (макс. 4)
     * @return int ID созданного поста
     */
    public function create($userId, $content, $parentId = null, $isQuickReply = false, $mediaFiles = []) {
        // Очистка пробелов
        $content = trim($content);

        if (empty($content)) throw new Exception("Post content cannot be empty");
        if (strlen($content) > 280)  throw new Exception("Post content cannot exceed 280 characters");

        // Проверка количества медиафайлов
        if (count($mediaFiles) > 4) throw new Exception("Maximum 4 media files allowed");

        // Проверяем существование родительского поста
        if ($parentId !== null) {
            $exists = $this->db->query("SELECT id FROM posts WHERE id = ?", [$parentId])->fetch();
            if (!$exists) throw new Exception("Parent post not found");
        }

        // Создание поста
        $stmt = $this->db->query(
            "INSERT INTO posts (user_id, content, parent_id, is_quick_reply) VALUES (?, ?, ?, ?) RETURNING id",
            [$userId, $content, $parentId, $isQuickReply ? 'true' : 'false']
        );
        $postId = $stmt->fetch()['id'];

        // Сохранение медиафайлов
        if (!empty($mediaFiles)) {
            foreach ($mediaFiles as $index => $media) {
                $thumbUrl = isset($media['thumb']) ? $media['thumb'] : null;
                $this->db->query(
                    "INSERT INTO post_media (post_id, media_url, media_type, display_order, thumb_url) VALUES (?, ?, ?, ?, ?)",
                    [$postId, $media['url'], $media['type'], $index, $thumbUrl]
                );
            }

            // Удаляем медиа из temp_uploads — теперь они привязаны к посту
            try {
                foreach ($mediaFiles as $media) {
                    $this->db->query(
                        "DELETE FROM temp_uploads WHERE user_id = ? AND file_path = ?",
                        [$userId, $media['url']]
                    );
                }
            } catch (Exception $e) {
                // Игнорируем ошибки (таблица может не существовать в старых установках)
            }
        }

        return $postId;
    }

    /**
     * Получить ленту новостей (главная страница)
     * Показывает: оригинальные посты (parent_id IS NULL) + быстрые ответы (is_quick_reply = TRUE)
     * НЕ показывает: thread replies (is_quick_reply = FALSE)
     */
    public function getFeed($userId = null, $limit = 20, $offset = 0) {
        $sql = $this->baseSelect($userId !== null);
        $sql .= " FROM posts p JOIN users u ON p.user_id = u.id
                  WHERE (p.parent_id IS NULL OR p.is_quick_reply = TRUE)
                  ORDER BY p.created_at DESC LIMIT ? OFFSET ?";

        $params = $userId !== null ? [$userId, $limit, $offset] : [$limit, $offset];
        $posts = $this->db->query($sql, $params)->fetchAll();
        return $this->attachMedia($posts);
    }

    /**
     * Получить посты пользователя для таба "Посты" в профиле
     * Все посты пользователя (оригинальные + быстрые ответы + thread replies)
     */
    public function getByUserId($userId, $limit = 20, $offset = 0, $currentUserId = null) {
        $sql = $this->baseSelect($currentUserId !== null);
        $sql .= " FROM posts p JOIN users u ON p.user_id = u.id
                  WHERE p.user_id = ?
                  ORDER BY p.created_at DESC
                  LIMIT ? OFFSET ?";

        $params = $currentUserId !== null
            ? [$currentUserId, $userId, $limit, $offset]
            : [$userId, $limit, $offset];

        $posts = $this->db->query($sql, $params)->fetchAll();
        return $this->attachMedia($posts);
    }

    /**
     * Получить пост по ID
     * @param int $postId - ID поста
     * @param int|null $userId - ID текущего пользователя (для is_liked)
     * @return array Данные поста
     */
    public function getById($postId, $userId = null) {
        $sql = $this->baseSelect($userId !== null);
        $sql .= " FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?";

        $params = $userId !== null ? [$userId, $postId] : [$postId];
        $post = $this->db->query($sql, $params)->fetch();

        if (!$post) throw new Exception("Post not found");

        $posts = $this->attachMedia([$post]);
        return $posts[0];
    }

    /**
     * Получить ответы пользователя для таба "Ответы" в профиле
     * Показывает только thread replies на чужие твиты (исключает самоответы)
     * Возвращает массив с парами [reply, parent] для отображения треда
     */
    public function getRepliesByUser($userId, $currentUserId = null, $limit = 20, $offset = 0) {
        $sql = $this->baseSelect($currentUserId !== null);
        $sql .= " FROM posts p JOIN users u ON p.user_id = u.id
                  WHERE p.user_id = ? AND p.parent_id IS NOT NULL
                  AND p.parent_id NOT IN (SELECT id FROM posts WHERE user_id = ?)
                  ORDER BY p.created_at DESC LIMIT ? OFFSET ?";

        $params = $currentUserId !== null
            ? [$currentUserId, $userId, $userId, $limit, $offset]
            : [$userId, $userId, $limit, $offset];

        $replies = $this->db->query($sql, $params)->fetchAll();
        $replies = $this->attachMedia($replies);

        $parentSqlBase = $this->baseSelect(false);
        $parentSqlBase .= " FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?";

        $result = [];
        foreach ($replies as $reply) {
            $parent = null;
            if ($reply['parent_id']) {
                $parentData = $this->db->query($parentSqlBase, [$reply['parent_id']])->fetch();
                if ($parentData) {
                    $parentWithMedia = $this->attachMedia([$parentData]);
                    $parent = $parentWithMedia[0];
                }
            }
            $result[] = ['reply' => $reply, 'parent' => $parent];
        }
        return $result;
    }

    /**
     * Получить все ответы на конкретный пост (для детальной страницы)
     * @param int $postId - ID поста
     * @param int|null $userId - ID текущего пользователя
     * @return array Массив ответов
     */
    public function getReplies($postId, $userId = null) {
        $sql = $this->baseSelect($userId !== null);
        $sql .= " FROM posts p JOIN users u ON p.user_id = u.id
                  WHERE p.parent_id = ?
                  ORDER BY p.created_at ASC";

        $params = $userId !== null ? [$userId, $postId] : [$postId];
        $posts = $this->db->query($sql, $params)->fetchAll();
        return $this->attachMedia($posts);
    }

    /**
     * Удалить пост
     * Проверяет права доступа - только автор может удалить свой пост
     * Удаляет физические файлы медиа
     */
    public function delete($postId, $userId) {
        $post = $this->db->query("SELECT user_id FROM posts WHERE id = ?", [$postId])->fetch();
        if (!$post)                    throw new Exception("Post not found");
        if ($post['user_id'] != $userId) throw new Exception("Unauthorized to delete this post");

        // Получаем список медиафайлов для удаления
        try {
            $mediaFiles = $this->db->query("SELECT media_url, media_type, thumb_url FROM post_media WHERE post_id = ?", [$postId])->fetchAll();
            $basePath = realpath(__DIR__ . '/../../');

            foreach ($mediaFiles as $media) {
                $url = $media['media_url'];

                // HLS-видео: /uploads/videos/{uuid}/master.m3u8 → удалить директорию
                if (preg_match('#^/uploads/videos/([a-f0-9]+)/master\.m3u8$#', $url, $m)) {
                    $dir = $basePath . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR
                                     . 'videos'  . DIRECTORY_SEPARATOR . $m[1];
                    if (is_dir($dir)) {
                        $this->deleteDirectoryRecursive($dir);
                    }
                } else {
                    // Одиночный файл (изображение, GIF, старое видео)
                    $filePath = $basePath . DIRECTORY_SEPARATOR . ltrim(str_replace('/', DIRECTORY_SEPARATOR, $url), DIRECTORY_SEPARATOR);
                    if (file_exists($filePath)) unlink($filePath);

                    // Миниатюра для изображений
                    if (!empty($media['thumb_url'])) {
                        $thumbPath = $basePath . DIRECTORY_SEPARATOR . ltrim(str_replace('/', DIRECTORY_SEPARATOR, $media['thumb_url']), DIRECTORY_SEPARATOR);
                        if (file_exists($thumbPath)) unlink($thumbPath);
                    }
                }
            }
        } catch (Exception $e) {
            // Игнорируем ошибки удаления файлов
        }

        // Удаление поста (CASCADE удалит записи из post_media автоматически)
        $this->db->query("DELETE FROM posts WHERE id = ?", [$postId]);
        return true;
    }

    /**
     * Рекурсивное удаление директории (для HLS-видео)
     */
    private function deleteDirectoryRecursive($dir) {
        if (!is_dir($dir)) return;
        foreach (array_diff(scandir($dir), ['.', '..']) as $item) {
            $path = $dir . DIRECTORY_SEPARATOR . $item;
            is_dir($path) ? $this->deleteDirectoryRecursive($path) : unlink($path);
        }
        rmdir($dir);
    }

    /**
     * Увеличить счётчик просмотров поста
     * Вызывается при открытии детальной страницы
     */
    public function incrementViews($postId) {
        $this->db->query("UPDATE posts SET views_count = views_count + 1 WHERE id = ?", [$postId]);
        return true;
    }

    /**
     * Лайкнуть пост
     * ON CONFLICT DO NOTHING предотвращает дублирование лайков
     */
    public function like($postId, $userId) {
        $this->db->query(
            "INSERT INTO likes (post_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
            [$postId, $userId]
        );
        return true;
    }

    /**
     * Убрать лайк с поста
     */
    public function unlike($postId, $userId) {
        $this->db->query("DELETE FROM likes WHERE post_id = ? AND user_id = ?", [$postId, $userId]);
        return true;
    }
}
