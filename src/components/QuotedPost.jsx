import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/QuotedPost.css';

/**
 * Компонент цитируемого поста (quoted post)
 * Отображается внутри быстрых ответов (is_quick_reply = true) в виде карточки с рамкой
 *
 * @param {Object} post - Данные родительского поста
 * @param {Function} onClick - Обработчик клика (переход к исходному посту)
 */
const QuotedPost = ({ post, onClick }) => {
  const { t } = useAuth();

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs    = now - date;
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays  = Math.floor(diffMs / 86400000);

    if (diffMins  < 1)  return t('post.time.just_now');
    if (diffMins  < 60) return `${diffMins}${t('post.time.minutes')}`;
    if (diffHours < 24) return `${diffHours}${t('post.time.hours')}`;
    if (diffDays  < 7)  return `${diffDays}${t('post.time.days')}`;
    return date.toLocaleDateString(t('locale'), { day: 'numeric', month: 'short' });
  };

  return (
    <div className="quoted-post" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="quoted-post-header">
        <img
          src={post.avatar_url || `https://i.pravatar.cc/150?u=${post.username}`}
          alt="Avatar"
          className="avatar avatar-sm"
        />
        <Link to={`/profile/${post.username}`} className="quoted-post-name">
          {post.display_name}
        </Link>
        <span className="quoted-post-handle">@{post.username}</span>
        <span className="quoted-post-dot">·</span>
        <span className="quoted-post-time">{formatTime(post.created_at)}</span>
      </div>

      {post.parent_id && (
        <div className="quoted-post-replying">
          {t('profile.reply_to')} <Link to={`/profile/${post.parent_username || 'unknown'}`} className="quoted-post-reply-link">@{post.parent_username || 'unknown'}</Link>
        </div>
      )}

      <div className="quoted-post-content">{post.content}</div>

      {post.media && (() => {
        const mediaList = typeof post.media === 'string' ? JSON.parse(post.media) : post.media;
        if (mediaList.length === 0) return null;
        const sorted = [...mediaList].sort((a, b) => a.order - b.order);
        return (
          <div className={`quoted-post-images quoted-post-images-${Math.min(sorted.length, 4)}`}>
            {sorted.slice(0, 4).map((item, i) => (
              <div key={i} className="quoted-post-image-item">
                {item.type === 'video' ? (
                  <video src={item.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : item.type === 'gif' && item.url.endsWith('.mp4') ? (
                  <video src={item.url} loop muted autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <img src={item.thumb || item.url} alt={`Media ${i + 1}`} loading="lazy" />
                )}
                {item.type === 'gif' && <span className="quoted-media-badge">GIF</span>}
                {item.type === 'video' && <span className="quoted-media-badge">VIDEO</span>}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

export default QuotedPost;
