-- Добавление колонки tracking_id в таблицу temp_uploads
-- Для надежной отмены загрузки по уникальному идентификатору

ALTER TABLE temp_uploads
ADD COLUMN tracking_id VARCHAR(255) NULL;

-- Добавляем индекс для быстрого поиска по tracking_id
CREATE INDEX idx_temp_uploads_tracking_id ON temp_uploads(tracking_id);

-- Также добавим составной индекс для запросов с user_id
CREATE INDEX idx_temp_uploads_user_tracking ON temp_uploads(user_id, tracking_id);
