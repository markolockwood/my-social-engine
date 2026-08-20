-- Добавление настроек приватности

-- Защита постов: посты видны только подписчикам
ALTER TABLE users ADD COLUMN IF NOT EXISTS protected_posts BOOLEAN DEFAULT FALSE;

-- JSON-поле для дополнительных настроек приватности
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{}'::jsonb;

-- Индекс для быстрого поиска пользователей с защищенными постами
CREATE INDEX IF NOT EXISTS idx_users_protected_posts ON users(protected_posts) WHERE protected_posts = TRUE;

-- Индекс для GIN-поиска по JSONB (для будущих запросов по настройкам)
CREATE INDEX IF NOT EXISTS idx_users_privacy_settings ON users USING GIN (privacy_settings);
