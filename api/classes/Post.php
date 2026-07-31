<?php

class Post {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // Создаёт пост (макс. 280 символов), возвращает id
    public function create($userId, $content) {
        if (empty(trim($content))) {
            throw new Exception("Post content cannot be empty");
        }

        if (strlen($content) > 280) {
            throw new Exception("Post content cannot exceed 280 characters");
        }

        $stmt = $this->db->query(
            "INSERT INTO posts (user_id, content) VALUES (?, ?) RETURNING id",
            [$userId, trim($content)]
        );

        $result = $stmt->fetch();
        return $result['id'];
    }

    // Возвращает ленту постов со счётчиками лайков/комментов. Если передан userId, добавляет is_liked
    public function getFeed($userId = null, $limit = 20, $offset = 0) {
        $sql = "SELECT
                    p.id,
                    p.content,
                    p.created_at,
                    u.id as user_id,
                    u.username,
                    u.display_name,
                    u.avatar_url,
                    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count";

        if ($userId) {
            $sql .= ",
                    (SELECT COUNT(*) > 0 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked";
        }

        $sql .= "
                FROM posts p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?";

        $params = $userId ? [$userId, $limit, $offset] : [$limit, $offset];
        $stmt = $this->db->query($sql, $params);

        return $stmt->fetchAll();
    }

    // Возвращает посты конкретного пользователя
    public function getByUserId($userId, $limit = 20, $offset = 0, $currentUserId = null) {
        $sql = "SELECT
                    p.id,
                    p.content,
                    p.created_at,
                    u.id as user_id,
                    u.username,
                    u.display_name,
                    u.avatar_url,
                    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count";

        if ($currentUserId) {
            $sql .= ",
                    (SELECT COUNT(*) > 0 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked";
        }

        $sql .= "
                FROM posts p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = ?
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?";

        $params = $currentUserId ? [$currentUserId, $userId, $limit, $offset] : [$userId, $limit, $offset];
        $stmt = $this->db->query($sql, $params);

        return $stmt->fetchAll();
    }

    // Возвращает один пост по id
    public function getById($postId, $userId = null) {
        $sql = "SELECT
                    p.id,
                    p.content,
                    p.created_at,
                    u.id as user_id,
                    u.username,
                    u.display_name,
                    u.avatar_url,
                    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count";

        if ($userId) {
            $sql .= ",
                    (SELECT COUNT(*) > 0 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked";
        }

        $sql .= "
                FROM posts p
                JOIN users u ON p.user_id = u.id
                WHERE p.id = ?";

        $params = $userId ? [$userId, $postId] : [$postId];
        $stmt = $this->db->query($sql, $params);

        $post = $stmt->fetch();

        if (!$post) {
            throw new Exception("Post not found");
        }

        return $post;
    }

    // Удаляет пост. Проверяет, что пост принадлежит userId
    public function delete($postId, $userId) {
        $stmt = $this->db->query(
            "SELECT user_id FROM posts WHERE id = ?",
            [$postId]
        );

        $post = $stmt->fetch();

        if (!$post) {
            throw new Exception("Post not found");
        }

        if ($post['user_id'] != $userId) {
            throw new Exception("Unauthorized to delete this post");
        }

        $stmt = $this->db->query(
            "DELETE FROM posts WHERE id = ?",
            [$postId]
        );

        return true;
    }

    // Добавляет лайк. ON CONFLICT DO NOTHING — повторный лайк не вызовет ошибку
    public function like($postId, $userId) {
        try {
            $stmt = $this->db->query(
                "INSERT INTO likes (post_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                [$postId, $userId]
            );
            return true;
        } catch (Exception $e) {
            throw new Exception("Failed to like post");
        }
    }

    // Убирает лайк
    public function unlike($postId, $userId) {
        $stmt = $this->db->query(
            "DELETE FROM likes WHERE post_id = ? AND user_id = ?",
            [$postId, $userId]
        );
        return true;
    }
}
