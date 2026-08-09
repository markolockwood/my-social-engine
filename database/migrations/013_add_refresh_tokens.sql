-- Таблица для хранения refresh tokens
-- Один пользователь может иметь несколько токенов (разные устройства)
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    last_used_at TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Автоматическая очистка истёкших токенов (опционально, можно запускать через cron)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW();
