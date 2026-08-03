-- Добавляем колонку для сохранения громкости видео (0.0-1.0)
ALTER TABLE users ADD COLUMN IF NOT EXISTS video_volume DECIMAL(3,2) DEFAULT 0.45;
