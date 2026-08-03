-- Таблица для отслеживания временных загрузок (медиа без привязки к посту)
CREATE TABLE IF NOT EXISTS temp_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    media_type VARCHAR(20) NOT NULL, -- 'image', 'gif', 'video'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_temp_uploads_created_at ON temp_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_temp_uploads_user_id ON temp_uploads(user_id);
