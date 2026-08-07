import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { usePostsContext } from '../context/PostsContext';
import VideoPlayer from './VideoPlayer';
import Post from './Post';
import ComposeWidget from './ComposeWidget';
import ComposeReplyModal from './ComposeReplyModal';
import RepliesSortDropdown from './RepliesSortDropdown';
import '../styles/ImageLightbox.css';

const MediaLightbox = ({ media, initialIndex, post, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(false);
  const [postDetails, setPostDetails] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loadingMoreReplies, setLoadingMoreReplies] = useState(false);
  const [hasMoreReplies, setHasMoreReplies] = useState(true);
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [sortBy, setSortBy] = useState('recent'); // По умолчанию последние
  const [newRepliesCount, setNewRepliesCount] = useState(0);
  const { user, t } = useAuth();
  const { initPost, getPostState, toggleLike, incrementComments, updatePost } = usePostsContext();
  const navigate = useNavigate();
  const repliesOffsetRef = useRef(0);
  const lastReplyRef = useRef(null);
  const latestReplyIdRef = useRef(null); // ID последнего загруженного комментария

  // Инициализация состояния поста в глобальном контексте
  // Функция для загрузки дополнительных комментариев
  const loadMoreReplies = async () => {
    if (loadingMoreReplies || !hasMoreReplies) return;

    setLoadingMoreReplies(true);
    try {
      const res = await postsAPI.getReplies(post.id, 10, repliesOffsetRef.current);
      const fetchedReplies = res.data.posts || [];

      if (fetchedReplies.length < 10) {
        setHasMoreReplies(false);
      }

      setReplies(prev => [...prev, ...sortReplies(fetchedReplies, sortBy)]);
      repliesOffsetRef.current += fetchedReplies.length;
    } catch (err) {
      console.error('Failed to load more replies', err);
    } finally {
      setLoadingMoreReplies(false);
    }
  };

  // Intersection Observer для автоподгрузки комментариев
  // Функция сортировки комментариев
  const sortReplies = (repliesToSort, sortType) => {
    const sorted = [...repliesToSort];

    switch (sortType) {
      case 'recent':
        // Сортировка по времени (новые сверху)
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      case 'likes':
        // Сортировка по лайкам (больше сверху)
        return sorted.sort((a, b) => (parseInt(b.likes_count) || 0) - (parseInt(a.likes_count) || 0));

      case 'relevant':
        // Сортировка по релевантности (лайки + время)
        return sorted.sort((a, b) => {
          const scoreA = (parseInt(a.likes_count) || 0) * 2 + (new Date(a.created_at).getTime() / 1000000);
          const scoreB = (parseInt(b.likes_count) || 0) * 2 + (new Date(b.created_at).getTime() / 1000000);
          return scoreB - scoreA;
        });

      default:
        return sorted;
    }
  };

  // Обработчик изменения сортировки
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setReplies(prev => sortReplies(prev, newSort));
  };

  useEffect(() => {
    if (loadingMoreReplies || !hasMoreReplies || replies.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreReplies();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (lastReplyRef.current) {
      observer.observe(lastReplyRef.current);
    }

    return () => {
      if (lastReplyRef.current) {
        observer.unobserve(lastReplyRef.current);
      }
    };
  }, [loadingMoreReplies, hasMoreReplies, replies.length]);

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

  useEffect(() => {
    const fetchPostData = async () => {
      try {
        repliesOffsetRef.current = 0;
        setHasMoreReplies(true);
        const [postResponse, repliesResponse] = await Promise.all([
          postsAPI.getById(post.id),
          postsAPI.getReplies(post.id, 15, 0) // Первые 15 комментариев
        ]);
        setPostDetails(postResponse.data.post);
        const fetchedReplies = repliesResponse.data.posts || [];
        setReplies(sortReplies(fetchedReplies, 'recent')); // Применяем дефолтную сортировку
        repliesOffsetRef.current = fetchedReplies.length;

        // Запоминаем ID последнего комментария для отслеживания новых
        if (fetchedReplies.length > 0) {
          latestReplyIdRef.current = Math.max(...fetchedReplies.map(r => parseInt(r.id)));
        }

        // Если вернулось меньше 15, значит это все комментарии
        if (fetchedReplies.length < 15) {
          setHasMoreReplies(false);
        }
      } catch (err) {
        console.error('Failed to load post details', err);
      }
    };
    fetchPostData();

    // Блокируем скролл body когда лайтбокс открыт
    document.body.style.overflow = 'hidden';

    return () => {
      // Восстанавливаем скролл при закрытии
      document.body.style.overflow = '';
    };
  }, [post.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex(currentIndex - 1);
      if (e.key === 'ArrowRight' && currentIndex < media.length - 1) setCurrentIndex(currentIndex + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, media.length, onClose]);

  // Polling новых комментариев каждые 20 секунд
  useEffect(() => {
    if (!post.id) return;

    // Ждем пока загрузятся первые комментарии
    if (!latestReplyIdRef.current) return;

    const pollNewReplies = async () => {
      try {
        // Загружаем последние 15 комментариев
        const res = await postsAPI.getReplies(post.id, 15, 0);
        const freshReplies = res.data.posts || [];

        if (freshReplies.length === 0) return;

        // Находим новые комментарии (с ID больше последнего известного)
        const newReplies = freshReplies.filter(r => parseInt(r.id) > latestReplyIdRef.current);

        if (newReplies.length > 0) {
          setNewRepliesCount(newReplies.length);
        }
      } catch (err) {
        console.error('Failed to poll new replies', err);
      }
    };

    const interval = setInterval(pollNewReplies, 20000); // 20 секунд
    return () => clearInterval(interval);
  }, [post.id, replies.length]); // Добавляем replies.length чтобы перезапустить после загрузки

  // Показать новые комментарии
  const showNewReplies = async () => {
    try {
      const res = await postsAPI.getReplies(post.id, 15, 0);
      const freshReplies = res.data.posts || [];

      // Обновляем список комментариев
      setReplies(sortReplies(freshReplies, sortBy));
      repliesOffsetRef.current = freshReplies.length;

      // Обновляем последний ID
      if (freshReplies.length > 0) {
        latestReplyIdRef.current = Math.max(...freshReplies.map(r => parseInt(r.id)));
      }

      setNewRepliesCount(0);
    } catch (err) {
      console.error('Failed to load new replies', err);
    }
  };

  // Polling счетчиков поста каждые 15 секунд
  useEffect(() => {
    if (!post.id) return;

    const pollCounters = async () => {
      try {
        const res = await postsAPI.getCounters(post.id);
        const counters = res.data;

        // Обновляем через контекст
        updatePost(post.id, {
          isLiked: counters.is_liked || false,
          likesCount: parseInt(counters.likes_count) || 0,
          commentsCount: parseInt(counters.comments_count) || 0,
          viewsCount: parseInt(counters.views_count) || 0
        });
      } catch (err) {
        console.error('Failed to poll counters', err);
      }
    };

    const interval = setInterval(pollCounters, 15000); // 15 секунд
    return () => clearInterval(interval);
  }, [post.id, updatePost]);

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

  const handleReplyDeleted = (replyId) => {
    setReplies(replies.filter(r => r.id !== replyId));
    repliesOffsetRef.current = Math.max(0, repliesOffsetRef.current - 1);
    incrementComments(post.id, -1);
  };

  const formatFullDate = (timestamp) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString(t('locale'), { hour: 'numeric', minute: '2-digit', hour12: false });
    const dateStr = date.toLocaleDateString(t('locale'), { month: 'short', day: 'numeric', year: 'numeric' });
    return `${time} · ${dateStr}`;
  };

  const formatNumber = (num) => {
    const n = parseInt(num) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const currentMedia = media[currentIndex];

  if (showQuickReply) {
    return (
      <ComposeReplyModal
        post={post}
        onClose={() => setShowQuickReply(false)}
        onSuccess={(reply) => {
          setReplies(prev => [reply, ...prev]);
          repliesOffsetRef.current += 1;
          incrementComments(post.id, 1);
          setShowQuickReply(false);
        }}
      />
    );
  }

  return (
    <div className="image-lightbox-modal" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="lightbox-container">
        <div className="lightbox-left" onClick={onClose}>
          <button className="lightbox-close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>

          <div className="lightbox-image-wrapper">
            {currentMedia.type === 'gif' ? (
              currentMedia.url.endsWith('.mp4') ? (
                <video src={currentMedia.url} loop muted autoPlay playsInline onClick={(e) => e.stopPropagation()} />
              ) : (
                <img src={currentMedia.url} alt="GIF" onClick={(e) => e.stopPropagation()} />
              )
            ) : currentMedia.type === 'video' ? (
              <VideoPlayer
                src={currentMedia.url}
                autoPlay
                muted={false}
                showQuality
                objectFit="contain"
              />
            ) : (
              <img src={currentMedia.url} alt={`Image ${currentIndex + 1}`} onClick={(e) => e.stopPropagation()} />
            )}

            {media.length > 1 && (
              <>
                {currentIndex > 0 && (
                  <button
                    className="lightbox-nav lightbox-nav-prev"
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(currentIndex - 1); }}
                  >
                    ‹
                  </button>
                )}
                {currentIndex < media.length - 1 && (
                  <button
                    className="lightbox-nav lightbox-nav-next"
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(currentIndex + 1); }}
                  >
                    ›
                  </button>
                )}
              </>
            )}
          </div>

          <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-action"
              onClick={() => setShowQuickReply(true)}
            >
              <span>💬</span>
              <span>{commentsCount || 0}</span>
            </button>
            <button
              className={`lightbox-action ${isLiked ? 'liked' : ''}`}
              onClick={handleLike}
              disabled={!user || loading}
            >
              <span>{isLiked ? '❤️' : '🤍'}</span>
              <span>{likesCount || 0}</span>
            </button>
            <button className="lightbox-action"><span>🔖</span></button>
            <button className="lightbox-action"><span>📤</span></button>
          </div>

          {media.length > 1 && (
            <div className="lightbox-indicator">
              {currentIndex + 1} / {media.length}
            </div>
          )}
        </div>

        <div className="lightbox-right" onClick={(e) => e.stopPropagation()}>
          {postDetails && (
            <>
              <div className="lightbox-post-header">
                <img
                  src={postDetails.avatar_url || `https://i.pravatar.cc/150?u=${postDetails.username}`}
                  alt={postDetails.username}
                  className="lightbox-avatar"
                  onClick={() => { onClose(); navigate(`/profile/${postDetails.username}`); }}
                />
                <div className="lightbox-user-info">
                  <div className="lightbox-display-name">{postDetails.display_name}</div>
                  <div className="lightbox-username">@{postDetails.username}</div>
                </div>
              </div>

              <div className="lightbox-post-content">{postDetails.content}</div>

              <div className="lightbox-post-meta">
                <span>{formatFullDate(postDetails.created_at)}</span>
                <span className="lightbox-meta-dot">·</span>
                <span><b>{formatNumber(viewsCount)}</b> {t('post_page.views')}</span>
              </div>

              <div className="lightbox-post-stats-row">
                <div className="lightbox-stat">
                  <b>{formatNumber(commentsCount)}</b> {t('post_page.comments_count')}
                </div>
                <div className="lightbox-stat">
                  <b>{formatNumber(likesCount)}</b> {t('post_page.likes_count')}
                </div>
              </div>

              <div className="lightbox-sort-section">
                {replies.length > 0 && (
                  <RepliesSortDropdown sortBy={sortBy} onSortChange={handleSortChange} />
                )}
                {postDetails && parseInt(postDetails.quick_replies_count || 0) > 0 && (
                  <span className="lightbox-quotes-link">View quotes →</span>
                )}
              </div>

              <ComposeWidget
                parentPost={postDetails}
                onSuccess={(reply) => {
                  setReplies(prev => [reply, ...prev]);
                  repliesOffsetRef.current += 1;
                  latestReplyIdRef.current = Math.max(latestReplyIdRef.current || 0, parseInt(reply.id));
                  incrementComments(post.id, 1);
                }}
              />

              {newRepliesCount > 0 && (
                <div className="lightbox-new-replies-banner" onClick={showNewReplies}>
                  {t('post_page.show_new_replies', { count: newRepliesCount })}
                </div>
              )}

              <div className="lightbox-replies">
                {replies.length === 0 ? (
                  <div className="lightbox-no-replies">{t('post_page.no_comments')}</div>
                ) : (
                  <>
                    {replies.map((reply, index) => {
                      const isLastReply = index === replies.length - 1;
                      return (
                        <div key={reply.id} ref={isLastReply ? lastReplyRef : null}>
                          <Post post={reply} onDelete={handleReplyDeleted} />
                        </div>
                      );
                    })}

                    {loadingMoreReplies && (
                      <div className="loading-container">
                        <div className="loading-spinner">{t('feed.loading')}</div>
                      </div>
                    )}

                    {!loadingMoreReplies && !hasMoreReplies && replies.length > 0 && (
                      <div className="lightbox-no-more-replies">{t('post_page.no_more_replies') || 'Больше комментариев нет'}</div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaLightbox;
