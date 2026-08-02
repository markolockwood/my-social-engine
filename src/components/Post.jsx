import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import ComposeReplyModal from './ComposeReplyModal';
import QuotedPost from './QuotedPost';
import PostMedia from './PostMedia';
import '../styles/Post.css';

/**
 * Компонент поста для отображения в ленте/профиле
 * Поддерживает:
 * - Обычные посты
 * - Быстрые ответы с quoted post (цитируемая карточка внутри)
 * - Ретвиты (с индикатором "Вы ретвитнули")
 * - Действия: комментирование (💬), ретвит (🔄), лайк (❤️), просмотры (📊), закладки (🔖)
 *
 * @param {Object} post - Данные поста
 * @param {Function} onDelete - Callback после удаления
 * @param {Function} onReplyCreated - Callback после создания ответа
 * @param {Object} quotedPost - Родительский пост для быстрых ответов (опционально)
 */
const Post = ({ post, onDelete, onReplyCreated, quotedPost }) => {
  const navigate = useNavigate();
  const { user, t } = useAuth();

  const [isLiked,      setIsLiked]      = useState(post.is_liked      || false);
  const [likesCount,   setLikesCount]   = useState(parseInt(post.likes_count)    || 0);
  const [commentsCount,setCommentsCount]= useState(parseInt(post.comments_count) || 0);
  const [loading,      setLoading]      = useState(false);
  const [replyModalOpen, setReplyModalOpen] = useState(false);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user || loading) return;
    setLoading(true);
    try {
      if (isLiked) {
        await postsAPI.unlike(post.id);
        setIsLiked(false);
        setLikesCount((n) => n - 1);
      } else {
        await postsAPI.like(post.id);
        setIsLiked(true);
        setLikesCount((n) => n + 1);
      }
    } catch (err) {
      console.error('like error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(t('post.delete_confirm'))) return;
    try {
      await postsAPI.delete(post.id);
      if (onDelete) onDelete(post.id);
    } catch {
      alert(t('post.delete_error'));
    }
  };

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

  const handleReplySuccess = (newReply) => {
    setCommentsCount((n) => n + 1);
    if (onReplyCreated) onReplyCreated(newReply);
  };

  const isOwnPost = user && user.id === post.user_id;

  return (
    <article className="tweet" onClick={() => navigate(`/post/${post.id}`)}>
      <img
        src={post.avatar_url || `https://i.pravatar.cc/150?u=${post.username}`}
        alt="Avatar"
        className="avatar avatar-md"
        onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.username}`); }}
      />
      <div className="tweet-body">
        <div className="tweet-head">
          <span
            className="tweet-name"
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.username}`); }}
          >
            {post.display_name}
          </span>
          <span className="tweet-handle">@{post.username}</span>
          <span className="tweet-dot">·</span>
          <span className="tweet-time">{formatTime(post.created_at)}</span>
          {isOwnPost && (
            <button className="tweet-delete" onClick={handleDelete} title="Delete">×</button>
          )}
        </div>
        <div className="tweet-text">{post.content}</div>
        {/* Изображения поста */}
        {post.media && <PostMedia media={post.media} post={post} />}
        {/* Quoted post - цитируемая карточка для быстрых ответов (кликабельна) */}
        {quotedPost && <QuotedPost post={quotedPost} onClick={(e) => { e.stopPropagation(); navigate(`/post/${quotedPost.id}`); }} />}
        <div className="tweet-actions">
          <div className="tweet-action" onClick={(e) => { e.stopPropagation(); setReplyModalOpen(true); }}>
            <span>💬</span><span>{commentsCount || 0}</span>
          </div>
          <div
            className={`tweet-action like ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
            style={{ cursor: user ? 'pointer' : 'default' }}
          >
            <span>{isLiked ? '❤️' : '🤍'}</span>
            <span>{likesCount}</span>
          </div>
          <div className="tweet-action tweet-action-views">
            <span>📊</span>
            <span>{parseInt(post.views_count) || 0}</span>
          </div>
          <div className="tweet-action tweet-action-bookmark">
            <span>🔖</span>
          </div>
        </div>
      </div>

      {replyModalOpen && (
        <ComposeReplyModal
          post={post}
          onClose={() => setReplyModalOpen(false)}
          onSuccess={handleReplySuccess}
        />
      )}
    </article>
  );
};

export default Post;
