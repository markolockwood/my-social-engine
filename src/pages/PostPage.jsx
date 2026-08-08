import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { usePostsContext } from '../context/PostsContext';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import Post from '../components/Post';
import QuotedPost from '../components/QuotedPost';
import PostMedia from '../components/PostMedia';
import ComposeReplyModal from '../components/ComposeReplyModal';
import ComposeWidget from '../components/ComposeWidget';
import RepliesSortDropdown from '../components/RepliesSortDropdown';
import '../styles/PostPage.css';

/**
 * Детальная страница поста
 * Особенности:
 * - Крупный формат с развёрнутыми метаданными (дата, время, просмотры)
 * - Если пост является быстрым ответом (is_quick_reply = true), показывается quoted post внутри
 * - Родительский пост НЕ показывается сверху (в отличие от старой версии)
 * - Увеличивает счётчик просмотров при загрузке
 * - Сортировка ответов (UI готов, логика в разработке)
 */
const PostPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, t } = useAuth();
  const { initPost, getPostState, toggleLike, incrementComments, incrementViews, markPostViewed, updatePost } = usePostsContext();

  const [post,          setPost]          = useState(null);
  const [quotedPost,    setQuotedPost]    = useState(null); // Родительский пост для быстрых ответов
  const [replies,       setReplies]       = useState([]);
  const [newRepliesCount, setNewRepliesCount] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [loadingMoreReplies, setLoadingMoreReplies] = useState(false);
  const [hasMoreReplies, setHasMoreReplies] = useState(true);
  const [error,         setError]         = useState('');
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [sortBy,        setSortBy]        = useState('recent'); // По умолчанию последние
  const [actionLoading, setActionLoading] = useState(false);
  const repliesOffsetRef = useRef(0);
  const lastReplyRef = useRef(null);
  const latestReplyIdRef = useRef(null); // ID последнего загруженного комментария

  useEffect(() => {
    setLoading(true);
    setError('');
    repliesOffsetRef.current = 0;
    setHasMoreReplies(true);
    const load = async () => {
      try {
        const [postRes, repliesRes] = await Promise.all([
          postsAPI.getById(id),
          postsAPI.getReplies(id, 15, 0), // Первые 15 комментариев
        ]);
        const p = postRes.data.post;
        setPost(p);

        // Инициализируем состояние поста в глобальном контексте
        initPost(p.id, {
          isLiked: p.is_liked,
          likesCount: p.likes_count,
          commentsCount: p.comments_count,
          viewsCount: p.views_count
        });

        const fetchedReplies = repliesRes.data.posts || [];
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

        // Увеличиваем счётчик просмотров только если сервер реально его засчитал
        // (повторный просмотр в течение 30 минут не увеличивает счётчик).
        // markPostViewed защищает от дублирующего запроса, если пост только что
        // был засчитан через ленту (Post.jsx)
        if (markPostViewed(p.id)) {
          postsAPI.incrementView(id)
            .then((res) => {
              if (res.data.counted) incrementViews(p.id, 1);
            })
            .catch(() => {});
        }

        // Загружаем родительский пост только для быстрых ответов (is_quick_reply = true)
        // Это будет quoted post внутри твита
        if (p.parent_id && p.is_quick_reply) {
          try {
            const parentRes = await postsAPI.getById(p.parent_id);
            setQuotedPost(parentRes.data.post);
          } catch { setQuotedPost(null); }
        } else {
          setQuotedPost(null);
        }
      } catch {
        setError(t('post_page.not_found'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, initPost, incrementViews, markPostViewed, t]);

  // Функция для загрузки дополнительных комментариев
  const loadMoreReplies = async () => {
    if (loadingMoreReplies || !hasMoreReplies) return;

    setLoadingMoreReplies(true);
    try {
      const res = await postsAPI.getReplies(id, 10, repliesOffsetRef.current);
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

  // Intersection Observer для автоподгрузки комментариев
  useEffect(() => {
    if (loading || loadingMoreReplies || !hasMoreReplies || replies.length === 0) return;

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
  }, [loading, loadingMoreReplies, hasMoreReplies, replies.length]);

  // Убираем polling новых комментариев, так как теперь используем пагинацию
  // useEffect(() => {
  //   if (!id) return;
  //   const poll = async () => { ... };
  //   const interval = setInterval(poll, 20000);
  //   return () => clearInterval(interval);
  // }, [id]);

  // Polling новых комментариев каждые 20 секунд
  useEffect(() => {
    if (!id || loading || !latestReplyIdRef.current) return;

    const pollNewReplies = async () => {
      try {
        // Загружаем последние 15 комментариев
        const res = await postsAPI.getReplies(id, 15, 0);
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
  }, [id, loading]);

  // Показать новые комментарии
  const showNewReplies = async () => {
    try {
      const res = await postsAPI.getReplies(id, 15, 0);
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
    if (!id || loading) return;

    const pollCounters = async () => {
      try {
        const res = await postsAPI.getCounters(id);
        const counters = res.data;

        // Обновляем через контекст
        updatePost(id, {
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
  }, [id, loading, updatePost]);

  const handleLike = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);

    // Оптимистичное обновление UI
    toggleLike(id);

    try {
      const postState = getPostState(id);
      if (postState?.isLiked) {
        await postsAPI.unlike(id);
      } else {
        await postsAPI.like(id);
      }
    } catch (err) {
      console.error('like error', err);
      // Откатываем изменение при ошибке
      toggleLike(id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReplyDeleted = (replyId) => {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    repliesOffsetRef.current = Math.max(0, repliesOffsetRef.current - 1);
    incrementComments(id, -1);
  };

  const formatFullDate = (timestamp) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString(t('locale'), { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = date.toLocaleDateString(t('locale'), { month: 'short', day: 'numeric', year: 'numeric' });
    return `${time} · ${dateStr}`;
  };

  const formatNumber = (num) => {
    const n = parseInt(num) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  if (loading) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main">
          <div className="pp-loading">{t('post_page.loading')}</div>
        </main>
        <MobileNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main">
          <div className="pp-error">{error}</div>
        </main>
        <MobileNav />
      </div>
    );
  }

  // Получаем актуальное состояние из контекста
  const postState = getPostState(id) || {
    isLiked: post?.is_liked || false,
    likesCount: parseInt(post?.likes_count) || 0,
    commentsCount: parseInt(post?.comments_count) || 0,
    viewsCount: parseInt(post?.views_count) || 0
  };

  const { isLiked, likesCount, commentsCount, viewsCount } = postState;

  return (
    <div className="layout">
      <Sidebar />

      <main className="main">
        <div className="main-header">
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <h2>{t('post_page.back')}</h2>
        </div>

        <div className="pp-detail">
          <div className="pp-detail-header">
            <img
              src={post.avatar_url || `https://i.pravatar.cc/150?u=${post.username}`}
              alt="Avatar"
              className="avatar avatar-md"
              onClick={() => navigate(`/profile/${post.username}`)}
            />
            <div className="pp-detail-author">
              <Link to={`/profile/${post.username}`} className="pp-detail-name">{post.display_name}</Link>
              <span className="pp-detail-handle">@{post.username}</span>
            </div>
          </div>

          <div className="pp-detail-content">{post.content}</div>

          {post.media && <PostMedia media={post.media} post={post} />}

          {quotedPost && (
            <div style={{ marginBottom: '8px' }}>
              <QuotedPost post={quotedPost} onClick={() => navigate(`/post/${quotedPost.id}`)} />
            </div>
          )}

          <div className="pp-detail-meta">
            <span>{formatFullDate(post.created_at)}</span>
            <span className="pp-detail-dot">·</span>
            <span><b>{formatNumber(viewsCount)}</b> Views</span>
          </div>

          <div className="pp-detail-actions">
            <div
              className="pp-detail-action"
              onClick={() => user && setReplyModalOpen(true)}
              style={{ cursor: user ? 'pointer' : 'default' }}
            >
              <span>💬</span>
              <span>{formatNumber(commentsCount)}</span>
            </div>
            <div
              className={`pp-detail-action ${isLiked ? 'liked' : ''}`}
              onClick={handleLike}
            >
              <span>{isLiked ? '❤️' : '🤍'}</span>
              <span>{formatNumber(likesCount)}</span>
            </div>
            <div className="pp-detail-action">
              <span>🔖</span>
              <span>{formatNumber(0)}</span>
            </div>
          </div>

          <div className="pp-detail-footer">
            {replies.length > 0 && (
              <RepliesSortDropdown sortBy={sortBy} onSortChange={handleSortChange} />
            )}
            {post.quick_replies_count > 0 && (
              <span className="pp-detail-quotes-link">View quotes →</span>
            )}
          </div>
        </div>

        <ComposeWidget
          parentPost={post}
          onSuccess={(reply) => {
            setReplies(prev => [reply, ...prev]);
            repliesOffsetRef.current += 1;
            latestReplyIdRef.current = Math.max(latestReplyIdRef.current || 0, parseInt(reply.id));
            incrementComments(id, 1);
          }}
        />

        {newRepliesCount > 0 && (
          <div className="pp-new-replies-banner" onClick={showNewReplies}>
            {t('post_page.show_new_replies', { count: newRepliesCount })}
          </div>
        )}

        <div className="pp-replies-list">
          {replies.length === 0 ? (
            <div className="pp-no-replies">{t('post_page.no_comments')}</div>
          ) : (
            replies.map((reply, index) => {
              const isLastReply = index === replies.length - 1;
              return (
                <div key={reply.id} ref={isLastReply ? lastReplyRef : null}>
                  <Post post={reply} onDelete={handleReplyDeleted} />
                </div>
              );
            })
          )}

          {loadingMoreReplies && (
            <div className="loading-container">
              <div className="loading-spinner">{t('feed.loading')}</div>
            </div>
          )}

          {!loadingMoreReplies && !hasMoreReplies && replies.length > 0 && (
            <div className="pp-no-more-replies">{t('post_page.no_more_replies') || 'Больше комментариев нет'}</div>
          )}
        </div>
      </main>

      <aside className="right">
        <div className="search-box">🔍 {t('feed.search')}</div>
      </aside>

      <MobileNav />

      {replyModalOpen && post && (
        <ComposeReplyModal
          post={post}
          onClose={() => setReplyModalOpen(false)}
          onSuccess={(newReply) => {
            setReplies(prev => [newReply, ...prev]);
            repliesOffsetRef.current += 1;
            incrementComments(id, 1);
            setReplyModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default PostPage;
