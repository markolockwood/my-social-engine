-- Таблица для запросов на подписку (для защищённых аккаунтов)
CREATE TABLE IF NOT EXISTS follow_requests (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_follow_requests_follower ON follow_requests(follower_id);
CREATE INDEX IF NOT EXISTS idx_follow_requests_following ON follow_requests(following_id);
CREATE INDEX IF NOT EXISTS idx_follow_requests_created_at ON follow_requests(created_at DESC);
