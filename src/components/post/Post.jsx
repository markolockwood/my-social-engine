import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { usePostsContext } from '@/context/PostsContext';
import ComposeReplyModal from '@/components/compose/ComposeReplyModal';
import QuotedPost from './QuotedPost';
import PostMedia from './PostMedia';
import UserLink from '@/components/user/UserLink';
import UserDisplayName from '@/components/user/UserDisplayName';
import './Post.css';

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
  const { initPost, getPostState, toggleLike, incrementComments, incrementViews, markPostViewed, removePost, timeUpdateTrigger } = usePostsContext();

  const [loading, setLoading] = useState(false);
  const [replyModalOpen, setReplyModalOpen] = useState(false);

  // Засчитываем просмотр поста в ленте: пост должен провисеть в зоне видимости
  // хотя бы 1 секунду минимум наполовину, иначе быстрый скролл считал бы всё подряд
  const articleRef = useRef(null);
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;

    let viewTimer = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          viewTimer = setTimeout(() => {
            if (!markPostViewed(post.id)) return; // уже отправляли в этой сессии
            postsAPI.incrementView(post.id)
              .then((res) => {
                if (res.data.counted) incrementViews(post.id, 1);
              })
              .catch(() => {});
          }, 3000);
        } else {
          clearTimeout(viewTimer);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => {
      clearTimeout(viewTimer);
      observer.disconnect();
    };
  }, [post.id, markPostViewed, incrementViews]);

  // Инициализация состояния поста в глобальном контексте
  useEffect(() => {
    initPost(post.id, {
      isLiked: post.is_liked,
      likesCount: post.likes_count,
      commentsCount: post.comments_count,
      viewsCount: post.views_count
    });
  }, [post.id, post.is_liked, post.likes_count, post.comments_count, post.views_count, initPost]);

  // Получаем актуальное состояние из контекста
  const postState = getPostState(post.id) || {
    isLiked: post.is_liked || false,
    likesCount: parseInt(post.likes_count) || 0,
    commentsCount: parseInt(post.comments_count) || 0,
    viewsCount: parseInt(post.views_count) || 0
  };

  const { isLiked, likesCount, commentsCount, viewsCount } = postState;

  // Принудительное обновление при изменении timeUpdateTrigger для пересчета времени
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    forceUpdate(prev => prev + 1);
  }, [timeUpdateTrigger]);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user || loading) return;
    setLoading(true);

    // Оптимистичное обновление UI
    toggleLike(post.id);

    try {
      if (isLiked) {
        await postsAPI.unlike(post.id);
      } else {
        await postsAPI.like(post.id);
      }
    } catch (err) {
      console.error('like error', err);
      // Откатываем изменение при ошибке
      toggleLike(post.id);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(t('post.delete_confirm'))) return;
    try {
      await postsAPI.delete(post.id);
      removePost(post.id);
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
    incrementComments(post.id, 1);
    if (onReplyCreated) onReplyCreated(newReply);
  };

  const isOwnPost = user && user.id === post.user_id;

  return (
    <article ref={articleRef} className="tweet" onClick={() => navigate(`/post/${post.id}`)}>
      <img
        src={post.avatar_url || `https://i.pravatar.cc/150?u=${post.username}`}
        alt="Avatar"
        className="avatar avatar-md"
        onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.username}`); }}
      />
      <div className="tweet-body">
        <div className="tweet-head">
          <UserLink
            username={post.username}
            className="tweet-name"
            onClick={(e) => e.stopPropagation()}
          >
            <UserDisplayName
              displayName={post.display_name}
              isProtected={post.protected_posts}
            />
          </UserLink>
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
            <span>{viewsCount || 0}</span>
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
