-- Миграция: добавление таблицы для прикрепленных изображений к постам

-- Таблица для хранения изображений постов
CREATE TABLE IF NOT EXISTS post_images (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (display_order >= 0 AND display_order <= 3)
);

-- Индекс для быстрой выборки изображений поста
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);

-- Индекс для сортировки по порядку отображения
CREATE INDEX IF NOT EXISTS idx_post_images_order ON post_images(post_id, display_order);
