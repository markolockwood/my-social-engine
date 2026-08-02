ALTER TABLE posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_posts_views ON posts(views_count);
