-- Миграция: Добавление колонки process_pid для отслеживания FFmpeg процессов
-- Версия: 1.8.3
-- Дата: 2026-08-09

-- Добавляем колонку для хранения PID процесса конвертации видео
ALTER TABLE temp_uploads
ADD COLUMN IF NOT EXISTS process_pid INTEGER DEFAULT NULL;

-- Комментарий для документации
COMMENT ON COLUMN temp_uploads.process_pid IS 'PID процесса FFmpeg для возможности остановки конвертации';
