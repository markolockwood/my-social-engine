<?php

class User {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // Регистрирует нового пользователя, возвращает его id
    public function register($username, $email, $password, $displayName) {
        // Валидация формата ПЕРЕД проверкой в БД
        if (strlen($username) < 3 || strlen($username) > 50) {
            throw new Exception("Username must be between 3 and 50 characters");
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("Invalid email format");
        }

        if (strlen($password) < 6) {
            throw new Exception("Password must be at least 6 characters");
        }

        // Проверка существования (не раскрываем что именно занято)
        $stmt = $this->db->query(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            [$username, $email]
        );

        if ($stmt->fetch()) {
            // ОБОБЩЕННОЕ сообщение - защита от user enumeration
            throw new Exception("Registration failed. Please try different credentials");
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        // Сохранение IP-адреса регистрации
        $registrationIp = $_SERVER['REMOTE_ADDR'] ?? null;

        $stmt = $this->db->query(
            "INSERT INTO users (username, email, password_hash, display_name, registration_ip)
             VALUES (?, ?, ?, ?, ?) RETURNING id",
            [$username, $email, $passwordHash, $displayName, $registrationIp]
        );

        $result = $stmt->fetch();
        return $result['id'];
    }

    // Проверяет логин/пароль, возвращает данные пользователя без хэша пароля
    public function login($username, $password) {
        $stmt = $this->db->query(
            "SELECT id, username, email, password_hash, display_name, avatar_url, bio,
                    theme_preference, language
             FROM users WHERE username = ? OR email = ?",
            [$username, $username]
        );

        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            throw new Exception("Invalid credentials");
        }

        unset($user['password_hash']);
        return $user;
    }

    // Возвращает пользователя по id (без пароля)
    public function getById($id) {
        $stmt = $this->db->query(
            "SELECT id, username, email, display_name, bio, avatar_url, location, birth_date,
                    created_at, theme_preference, language, verified, registration_ip, country, gender
             FROM users WHERE id = ?",
            [$id]
        );

        $user = $stmt->fetch();

        if (!$user) {
            throw new Exception("User not found");
        }

        return $user;
    }

    // Возвращает профиль по username вместе со счётчиками подписок и постов
    public function getByUsername($username) {
        $stmt = $this->db->query(
            "SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url, u.location,
                    u.birth_date, u.created_at, u.protected_posts,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                    (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count
             FROM users u WHERE u.username = ?",
            [$username]
        );

        $user = $stmt->fetch();

        if (!$user) {
            throw new Exception("User not found");
        }

        return $user;
    }

    // Обновляет поля профиля пользователя (только переданные поля)
    public function updateProfile($userId, array $data) {
        $allowed = ['display_name', 'bio', 'location', 'birth_date', 'avatar_url'];
        $sets = [];
        $params = [];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $sets[] = "$field = ?";
                $params[] = $data[$field];
            }
        }

        if (empty($sets)) return true;

        $params[] = $userId;
        $stmt = $this->db->query(
            "UPDATE users SET " . implode(', ', $sets) . " WHERE id = ? RETURNING id",
            $params
        );

        return $stmt->fetch() !== false;
    }

    // Сохраняет предпочтение темы ('light' или 'dark')
    public function updateTheme($userId, $theme) {
        if (!in_array($theme, ['light', 'dark'])) {
            throw new Exception("Invalid theme value");
        }

        $this->db->query(
            "UPDATE users SET theme_preference = ? WHERE id = ?",
            [$theme, $userId]
        );

        return true;
    }

    // Сохраняет предпочтение языка ('en', 'ru', ...)
    public function updateLanguage($userId, $language) {
        if (!preg_match('/^[a-z]{2}$/', $language)) {
            throw new Exception("Invalid language code");
        }

        $this->db->query(
            "UPDATE users SET language = ? WHERE id = ?",
            [$language, $userId]
        );

        return true;
    }

    // Подписка на пользователя
    public function follow($followerId, $followingId) {
        if ($followerId === $followingId) {
            throw new Exception("Cannot follow yourself");
        }

        // Проверяем существование обоих пользователей
        $stmt = $this->db->query(
            "SELECT id FROM users WHERE id IN (?, ?)",
            [$followerId, $followingId]
        );

        if ($stmt->rowCount() !== 2) {
            throw new Exception("User not found");
        }

        // Проверяем, не подписан ли уже
        $stmt = $this->db->query(
            "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
            [$followerId, $followingId]
        );

        if ($stmt->fetch()) {
            throw new Exception("Already following");
        }

        // Создаем подписку
        $this->db->query(
            "INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
            [$followerId, $followingId]
        );

        return true;
    }

    // Отписка от пользователя
    public function unfollow($followerId, $followingId) {
        $stmt = $this->db->query(
            "DELETE FROM follows WHERE follower_id = ? AND following_id = ? RETURNING id",
            [$followerId, $followingId]
        );

        if (!$stmt->fetch()) {
            throw new Exception("Not following");
        }

        return true;
    }

    // Проверяет, подписан ли follower на following
    public function isFollowing($followerId, $followingId) {
        $stmt = $this->db->query(
            "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
            [$followerId, $followingId]
        );

        return $stmt->fetch() !== false;
    }

    // Получает список подписчиков пользователя
    public function getFollowers($userId, $limit = 20, $offset = 0, $currentUserId = null) {
        $stmt = $this->db->query(
            "SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
             FROM users u
             INNER JOIN follows f ON u.id = f.follower_id
             WHERE f.following_id = ?
             ORDER BY f.created_at DESC
             LIMIT ? OFFSET ?",
            [$userId, $limit, $offset]
        );

        $users = $stmt->fetchAll();

        // Если есть текущий пользователь, проверяем статус подписки на каждого
        if ($currentUserId) {
            foreach ($users as &$user) {
                $user['is_following'] = $this->isFollowing($currentUserId, $user['id']);
            }
        }

        return $users;
    }

    // Получает список подписок пользователя (на кого подписан)
    public function getFollowing($userId, $limit = 20, $offset = 0, $currentUserId = null) {
        $stmt = $this->db->query(
            "SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
             FROM users u
             INNER JOIN follows f ON u.id = f.following_id
             WHERE f.follower_id = ?
             ORDER BY f.created_at DESC
             LIMIT ? OFFSET ?",
            [$userId, $limit, $offset]
        );

        $users = $stmt->fetchAll();

        // Если есть текущий пользователь, проверяем статус подписки на каждого
        if ($currentUserId) {
            foreach ($users as &$user) {
                $user['is_following'] = $this->isFollowing($currentUserId, $user['id']);
            }
        }

        return $users;
    }
}
