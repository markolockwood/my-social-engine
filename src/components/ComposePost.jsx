import React, { useState } from 'react';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import '../styles/Compose.css';

const ComposePost = ({ onPostCreated }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { user, t } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await postsAPI.create(content);
      setContent('');
      if (onPostCreated) onPostCreated(response.data.post);
    } catch (err) {
      setError(err.response?.data?.error || t('compose.error'));
    } finally {
      setLoading(false);
    }
  };

  const remainingChars = 280 - content.length;
  const isOverLimit    = remainingChars < 0;

  return (
    <div className="compose">
      <img
        src={user?.avatar_url || `https://i.pravatar.cc/150?u=${user?.username}`}
        alt="Avatar"
        className="avatar avatar-md"
      />
      <form onSubmit={handleSubmit} style={{ flex: 1 }}>
        <textarea
          placeholder={t('compose.placeholder')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading}
        />
        {error && <div className="error-text">{error}</div>}
        <div className="compose-footer">
          <div className="compose-icons">
            <span>🖼️</span><span>📊</span><span>😊</span><span>📅</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className={`char-count ${isOverLimit ? 'over-limit' : ''}`}>
              {remainingChars}
            </span>
            <button
              type="submit"
              className="compose-submit"
              disabled={loading || !content.trim() || isOverLimit}
            >
              {loading ? t('compose.submitting') : t('compose.submit')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ComposePost;
