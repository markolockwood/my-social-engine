-- Миграция: объединение медиафайлов в одну таблицу

-- Создаем новую таблицу для всех типов медиа
CREATE TABLE IF NOT EXISTS post_media (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_url VARCHAR(255) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'gif', 'video')),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (display_order >= 0 AND display_order <= 3)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_order ON post_media(post_id, display_order);