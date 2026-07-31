<?php

class Post {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    private function baseSelect($withUserId = false) {
        $sql = "SELECT
                    p.id,
                    p.content,
                    p.created_at,
                    p.parent_id,
                    p.is_quick_reply,
                    u.id as user_id,
                    u.username,
                    u.display_name,
                    u.avatar_url,
                    (SELECT username FROM posts parent JOIN users pu ON parent.user_id = pu.id WHERE parent.id = p.parent_id) as parent_username,
                    (SELECT COUNT(*) FROM likes    WHERE post_id = p.id) as likes_count,
                    (SELECT COUNT(*) FROM posts    WHERE parent_id = p.id) as comments_count,
                    (SELECT COUNT(*) FROM retweets WHERE post_id = p.id) as retweets_count";
        if ($withUserId) {
            $sql .= ",
                    (SELECT COUNT(*) > 0 FROM likes    WHERE post_id = p.id AND user_id = ?) as is_liked,
                    (SELECT COUNT(*) > 0 FROM retweets WHERE post_id = p.id AND user_id = ?) as is_retweeted";
        }
        return $sql;
    }

    public function create($userId, $content, $parentId = null, $isQuickReply = false) {
        if (empty(trim($content))) throw new Exception("Post content cannot be empty");
        if (strlen($content) > 280)  throw new Exception("Post content cannot exceed 280 characters");

        if ($parentId !== null) {
            $exists = $this->db->query("SELECT id FROM posts WHERE id = ?", [$parentId])->fetch();
            if (!$exists) throw new Exception("Parent post not found");
        }

        $stmt = $this->db->query(
            "INSERT INTO posts (user_id, content, parent_id, is_quick_reply) VALUES (?, ?, ?, ?) RETURNING id",
            [$userId, trim($content), $parentId, $isQuickReply ? 'true' : 'false']
        );
        return $stmt->fetch()['id'];
    }

    public function getFeed($userId = null, $limit = 20, $offset = 0) {
        $sql = $this->baseSelect($userId !== null);
        $sql .= " FROM posts p JOIN users u ON p.user_id = u.id
                  WHERE p.parent_id IS NULL
                  ORDER BY p.created_at DESC LIMIT ? OFFSET ?";

        $params = $userId !== null ? [$userId, $userId, $limit, $offset] : [$limit, $offset];
        return $this->db->query($sql, $params)->fetchAll();
    }

    public function getByUserId($userId, $limit = 20, $offset = 0, $currentUserId = null) {
        // Get original posts and replies by user
        $postsSql = $this->baseSelect($currentUserId !== null);
        $postsSql .= ", NULL as retweeted_at, FALSE as is_retweet
                      FROM posts p JOIN users u ON p.user_id = u.id
                      WHERE p.user_id = ?";

        // Get retweets by user (showing the retweeted post with retweet metadata)
        $retweetsSql = $this->baseSelect($currentUserId !== null);
        $retweetsSql .= ", r.created_at as retweeted_at, TRUE as is_retweet
                         FROM retweets r
                         JOIN posts p ON r.post_id = p.id
                         JOIN users u ON p.user_id = u.id
                         WHERE r.user_id = ?";

        // Union and order by created_at (or retweeted_at for retweets)
        $sql = "SELECT * FROM (
                    ({$postsSql})
                    UNION ALL
                    ({$retweetsSql})
                ) combined
                ORDER BY COALESCE(retweeted_at, created_at) DESC
                LIMIT ? OFFSET ?";

        $params = $currentUserId !== null
            ? [$currentUserId, $currentUserId, $userId, $currentUserId, $currentUserId, $userId, $limit, $offset]
            : [$userId, $userId, $limit, $offset];

        return $this->db->query($sql, $params)->fetchAll();
    }

    public function getById($postId, $userId = null) {
        $sql = $this->baseSelect($userId !== null);
        $sql .= " FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?";

        $params = $userId !== null ? [$userId, $userId, $postId] : [$postId];
        $post = $this->db->query($sql, $params)->fetch();

        if (!$post) throw new Exception("Post not found");
        return $post;
    }

    public function getRepliesByUser($userId, $currentUserId = null, $limit = 20, $offset = 0) {
        $sql = $this->baseSelect($currentUserId !== null);
        $sql .= " FROM posts p JOIN users u ON p.user_id = u.id
                  WHERE p.user_id = ? AND p.parent_id IS NOT NULL
                  AND p.parent_id NOT IN (SELECT id FROM posts WHERE user_id = ?)
                  ORDER BY p.created_at DESC LIMIT ? OFFSET ?";

        $params = $currentUserId !== null
            ? [$currentUserId, $currentUserId, $userId, $userId, $limit, $offset]
            : [$userId, $userId, $limit, $offset];

        $replies = $this->db->query($sql, $params)->fetchAll();

        $parentSqlBase = $this->baseSelect(false);
        $parentSqlBase .= " FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?";

        $result = [];
        foreach ($replies as $reply) {
            $parent = null;
            if ($reply['parent_id']) {
                $parent = $this->db->query($parentSqlBase, [$reply['parent_id']])->fetch() ?: null;
            }
            $result[] = ['reply' => $reply, 'parent' => $parent];
        }
        return $result;
    }

    public function getReplies($postId, $userId = null) {
        $sql = $this->baseSelect($userId !== null);
        $sql .= " FROM posts p JOIN users u ON p.user_id = u.id
                  WHERE p.parent_id = ?
                  ORDER BY p.created_at ASC";

        $params = $userId !== null ? [$userId, $userId, $postId] : [$postId];
        return $this->db->query($sql, $params)->fetchAll();
    }

    public function delete($postId, $userId) {
        $post = $this->db->query("SELECT user_id FROM posts WHERE id = ?", [$postId])->fetch();
        if (!$post)                    throw new Exception("Post not found");
        if ($post['user_id'] != $userId) throw new Exception("Unauthorized to delete this post");

        $this->db->query("DELETE FROM posts WHERE id = ?", [$postId]);
        return true;
    }

    public function like($postId, $userId) {
        $this->db->query(
            "INSERT INTO likes (post_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
            [$postId, $userId]
        );
        return true;
    }

    public function unlike($postId, $userId) {
        $this->db->query("DELETE FROM likes WHERE post_id = ? AND user_id = ?", [$postId, $userId]);
        return true;
    }

    public function retweet($postId, $userId) {
        $this->db->query(
            "INSERT INTO retweets (post_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
            [$postId, $userId]
        );
        return true;
    }

    public function unretweet($postId, $userId) {
        $this->db->query("DELETE FROM retweets WHERE post_id = ? AND user_id = ?", [$postId, $userId]);
        return true;
    }
}
