ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_quick_reply BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_posts_quick_reply ON posts(is_quick_reply) WHERE is_quick_reply = TRUE;
