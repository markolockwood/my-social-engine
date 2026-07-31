<?php

class User {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // Регистрирует нового пользователя, возвращает его id
    public function register($username, $email, $password, $displayName) {
        $stmt = $this->db->query(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            [$username, $email]
        );

        if ($stmt->fetch()) {
            throw new Exception("Username or email already exists");
        }

        if (strlen($username) < 3 || strlen($username) > 50) {
            throw new Exception("Username must be between 3 and 50 characters");
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("Invalid email format");
        }

        if (strlen($password) < 6) {
            throw new Exception("Password must be at least 6 characters");
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $this->db->query(
            "INSERT INTO users (username, email, password_hash, display_name)
             VALUES (?, ?, ?, ?) RETURNING id",
            [$username, $email, $passwordHash, $displayName]
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
                    created_at, theme_preference, language
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
                    u.birth_date, u.created_at,
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
}
