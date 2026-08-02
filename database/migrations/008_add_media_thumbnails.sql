-- Добавляем поле для хранения URL миниатюры

ALTER TABLE post_media ADD COLUMN thumb_url VARCHAR(255);

-- Индекс не нужен, так как thumb_url используется только при выборке вместе с media_url
