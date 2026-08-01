import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import Post from '../components/Post';
import QuotedPost from '../components/QuotedPost';
import PostImages from '../components/PostImages';
import ComposeReplyModal from '../components/ComposeReplyModal';
import ComposeWidget from '../components/ComposeWidget';
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

  const [post,          setPost]          = useState(null);
  const [quotedPost,    setQuotedPost]    = useState(null); // Родительский пост для быстрых ответов
  const [replies,       setReplies]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [sortBy,        setSortBy]        = useState('relevant');
  const [isLiked,       setIsLiked]       = useState(false);
  const [likesCount,    setLikesCount]    = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        const [postRes, repliesRes] = await Promise.all([
          postsAPI.getById(id),
          postsAPI.getReplies(id),
        ]);
        const p = postRes.data.post;
        setPost(p);
        setIsLiked(p.is_liked || false);
        setLikesCount(parseInt(p.likes_count) || 0);
        setCommentsCount(parseInt(p.comments_count) || 0);
        setReplies(repliesRes.data.posts);

        postsAPI.incrementView(id).catch(() => {}); // Увеличиваем счётчик просмотров (не критично при ошибке)

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
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const poll = async () => {
      try {
        const res = await postsAPI.getReplies(id);
        const fresh = res.data.posts || [];
        setReplies(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const added = fresh.filter(r => !existingIds.has(r.id));
          return added.length > 0 ? [...prev, ...added] : prev;
        });
      } catch {}
    };
    const interval = setInterval(poll, 20000);
    return () => clearInterval(interval);
  }, [id]);

  const handleLike = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);
    try {
      if (isLiked) {
        await postsAPI.unlike(id);
        setIsLiked(false);
        setLikesCount((n) => n - 1);
      } else {
        await postsAPI.like(id);
        setIsLiked(true);
        setLikesCount((n) => n + 1);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReplyDeleted = (replyId) => {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    setCommentsCount((n) => Math.max(0, n - 1));
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

          {/* Изображения поста */}
          {post.images && <PostImages images={post.images} post={post} />}

          {quotedPost && (
            <div style={{ marginBottom: '8px' }}>
              <QuotedPost post={quotedPost} onClick={() => navigate(`/post/${quotedPost.id}`)} />
            </div>
          )}

          <div className="pp-detail-meta">
            <span>{formatFullDate(post.created_at)}</span>
            <span className="pp-detail-dot">·</span>
            <span><b>{formatNumber(post.views_count)}</b> Views</span>
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
            <div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="pp-sort-select">
                <option value="relevant">Relevant</option>
                <option value="recent">Recent</option>
                <option value="likes">Likes</option>
              </select>
            </div>
            <span className="pp-detail-quotes-link">View quotes →</span>
          </div>
        </div>

        <ComposeWidget
          parentPost={post}
          onSuccess={(reply) => {
            setReplies(prev => [...prev, reply]);
            setCommentsCount(n => n + 1);
          }}
        />

        <div className="pp-replies-list">
          {replies.length === 0 ? (
            <div className="pp-no-replies">{t('post_page.no_comments')}</div>
          ) : (
            replies.map((reply) => (
              <Post key={reply.id} post={reply} onDelete={handleReplyDeleted} />
            ))
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
            setReplies(prev => [...prev, newReply]);
            setCommentsCount(n => n + 1);
            setReplyModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default PostPage;
