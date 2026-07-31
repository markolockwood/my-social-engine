CREATE TABLE IF NOT EXISTS retweets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_retweets_post_id ON retweets(post_id);
CREATE INDEX IF NOT EXISTS idx_retweets_user_id ON retweets(user_id);
