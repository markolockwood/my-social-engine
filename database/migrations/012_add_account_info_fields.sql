-- Добавление полей для раздела Account Information

-- Верификация пользователя
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- IP регистрации
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(45);

-- Страна пользователя (ISO код, например 'US', 'RU')
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2);

-- Пол пользователя ('male', 'female', или кастомное значение до 16 символов)
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(16);
