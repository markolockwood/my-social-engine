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
     * Получить изображения для постов
     * @param array $posts - массив постов
     * @return array Посты с добавленным полем images
     */
    private function attachImages($posts) {
        if (empty($posts)) return $posts;

        // Собираем все ID постов
        $postIds = array_column($posts, 'id');
        if (empty($postIds)) return $posts;

        $placeholders = implode(',', array_fill(0, count($postIds), '?'));

        // Получаем все изображения одним запросом
        $sql = "SELECT post_id, image_url, display_order
                FROM post_images
                WHERE post_id IN ($placeholders)
                ORDER BY post_id, display_order";

        try {
            $images = $this->db->query($sql, $postIds)->fetchAll();
        } catch (Exception $e) {
            // Если таблица не существует, возвращаем посты без изображений
            foreach ($posts as &$post) {
                $post['images'] = '[]';
            }
            return $posts;
        }

        // Группируем изображения по post_id
        $imagesByPost = [];
        foreach ($images as $img) {
            if (!isset($imagesByPost[$img['post_id']])) {
                $imagesByPost[$img['post_id']] = [];
            }
            $imagesByPost[$img['post_id']][] = [
                'url' => $img['image_url'],
                'order' => (int)$img['display_order']
            ];
        }

        // Добавляем изображения к постам
        foreach ($posts as &$post) {
            $post['images'] = isset($imagesByPost[$post['id']])
                ? json_encode($imagesByPost[$post['id']])
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
     * @param array $imageUrls - Массив URL изображений (макс. 4)
     * @return int ID созданного поста
     */
    public function create($userId, $content, $parentId = null, $isQuickReply = false, $imageUrls = []) {
        if (empty(trim($content))) throw new Exception("Post content cannot be empty");
        if (strlen($content) > 280)  throw new Exception("Post content cannot exceed 280 characters");

        // Проверка количества изображений
        if (count($imageUrls) > 4) throw new Exception("Maximum 4 images allowed");

        // Проверяем существование родительского поста
        if ($parentId !== null) {
            $exists = $this->db->query("SELECT id FROM posts WHERE id = ?", [$parentId])->fetch();
            if (!$exists) throw new Exception("Parent post not found");
        }

        // Создание поста
        $stmt = $this->db->query(
            "INSERT INTO posts (user_id, content, parent_id, is_quick_reply) VALUES (?, ?, ?, ?) RETURNING id",
            [$userId, trim($content), $parentId, $isQuickReply ? 'true' : 'false']
        );
        $postId = $stmt->fetch()['id'];

        // Сохранение изображений
        if (!empty($imageUrls)) {
            foreach ($imageUrls as $index => $url) {
                $this->db->query(
                    "INSERT INTO post_images (post_id, image_url, display_order) VALUES (?, ?, ?)",
                    [$postId, $url, $index]
                );
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
        return $this->attachImages($posts);
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
        return $this->attachImages($posts);
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

        $posts = $this->attachImages([$post]);
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
        $replies = $this->attachImages($replies);

        // Для каждого ответа загружаем родительский пост (для отображения треда)
        $parentSqlBase = $this->baseSelect(false);
        $parentSqlBase .= " FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?";

        $result = [];
        foreach ($replies as $reply) {
            $parent = null;
            if ($reply['parent_id']) {
                $parentData = $this->db->query($parentSqlBase, [$reply['parent_id']])->fetch();
                if ($parentData) {
                    $parentWithImages = $this->attachImages([$parentData]);
                    $parent = $parentWithImages[0];
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
        return $this->attachImages($posts);
    }

    /**
     * Удалить пост
     * Проверяет права доступа - только автор может удалить свой пост
     * Удаляет физические файлы изображений
     */
    public function delete($postId, $userId) {
        $post = $this->db->query("SELECT user_id FROM posts WHERE id = ?", [$postId])->fetch();
        if (!$post)                    throw new Exception("Post not found");
        if ($post['user_id'] != $userId) throw new Exception("Unauthorized to delete this post");

        // Получаем список изображений для удаления файлов
        $images = $this->db->query("SELECT image_url FROM post_images WHERE post_id = ?", [$postId])->fetchAll();

        // Удаляем физические файлы
        foreach ($images as $image) {
            $filePath = __DIR__ . '/../../' . $image['image_url'];
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }

        // Удаление поста (CASCADE удалит записи из post_images автоматически)
        $this->db->query("DELETE FROM posts WHERE id = ?", [$postId]);
        return true;
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
