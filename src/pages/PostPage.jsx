import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import Post from '../components/Post';
import '../styles/PostPage.css';

const PostPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, t } = useAuth();

  const [post,          setPost]          = useState(null);
  const [parentPost,    setParentPost]    = useState(null);
  const [replies,       setReplies]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [replyText,     setReplyText]     = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [replyError,    setReplyError]    = useState('');
  const [isLiked,       setIsLiked]       = useState(false);
  const [likesCount,    setLikesCount]    = useState(0);
  const [isRetweeted,   setIsRetweeted]   = useState(false);
  const [retweetsCount, setRetweetsCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const textareaRef = useRef(null);

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
        setIsRetweeted(p.is_retweeted || false);
        setRetweetsCount(parseInt(p.retweets_count) || 0);
        setReplies(repliesRes.data.posts);

        if (p.parent_id) {
          try {
            const parentRes = await postsAPI.getById(p.parent_id);
            setParentPost(parentRes.data.post);
          } catch { setParentPost(null); }
        } else {
          setParentPost(null);
        }
      } catch {
        setError(t('post_page.not_found'));
      } finally {
        setLoading(false);
      }
    };
    load();
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

  const handleRetweet = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);
    try {
      if (isRetweeted) {
        await postsAPI.unretweet(id);
        setIsRetweeted(false);
        setRetweetsCount((n) => n - 1);
      } else {
        await postsAPI.retweet(id);
        setIsRetweeted(true);
        setRetweetsCount((n) => n + 1);
      }
    } catch {
      alert(t('post_page.retweet_error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm(t('post.delete_confirm'))) return;
    try {
      await postsAPI.delete(id);
      navigate(-1);
    } catch {
      alert(t('post.delete_error'));
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    setReplyError('');
    try {
      const res = await postsAPI.create(replyText.trim(), parseInt(id));
      setReplies((prev) => [...prev, res.data.post]);
      setReplyText('');
      setPost((p) => ({ ...p, comments_count: parseInt(p.comments_count) + 1 }));
    } catch {
      setReplyError(t('post_page.comment_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyDeleted = (replyId) => {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    setPost((p) => ({ ...p, comments_count: Math.max(0, parseInt(p.comments_count) - 1) }));
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

  const isOwnPost = user && post && user.id === post.user_id;

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <div className="pp-header">
          <button className="pp-back" onClick={() => navigate(-1)} aria-label="Back">←</button>
          <span className="pp-header-title">Твит</span>
        </div>

        {parentPost && (
          <div className="pp-parent-post">
            <div className="pp-parent-thread-line" />
            <div className="pp-parent-content">
              <img
                src={parentPost.avatar_url || `https://i.pravatar.cc/150?u=${parentPost.username}`}
                alt="Avatar"
                className="avatar avatar-sm pp-parent-avatar"
              />
              <div className="pp-parent-text-col">
                <div className="pp-parent-meta">
                  <span className="pp-parent-name">{parentPost.display_name}</span>
                  <span className="pp-parent-handle"> @{parentPost.username}</span>
                </div>
                <p className="pp-parent-body">{parentPost.content}</p>
              </div>
            </div>
            <div className="pp-replying-to">
              Replying to <Link to={`/profile/${parentPost.username}`}>@{parentPost.username}</Link>
            </div>
          </div>
        )}

        <article className="pp-post">
          <div className="pp-post-top">
            <Link to={`/profile/${post.username}`} className="pp-avatar-link">
              <img
                src={post.avatar_url || `https://i.pravatar.cc/150?u=${post.username}`}
                alt="Avatar"
                className="avatar avatar-md"
              />
            </Link>
            <div className="pp-post-meta">
              <Link to={`/profile/${post.username}`} className="pp-name">{post.display_name}</Link>
              <span className="pp-handle">@{post.username}</span>
            </div>
            {isOwnPost && (
              <button className="pp-delete" onClick={handleDeletePost} title="Delete">×</button>
            )}
          </div>

          <p className="pp-content">{post.content}</p>

          <div className="pp-timestamp">
            {new Date(post.created_at).toLocaleString(t('locale'), {
              hour: '2-digit', minute: '2-digit',
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </div>

          {(retweetsCount > 0 || likesCount > 0) && (
            <div className="pp-stats">
              {retweetsCount > 0 && <span><b>{retweetsCount}</b> Retweets</span>}
              {likesCount    > 0 && <span><b>{likesCount}</b> Likes</span>}
            </div>
          )}

          <div className="pp-actions">
            <button className="pp-action" onClick={() => textareaRef.current?.focus()} aria-label="Reply">
              <span className="pp-action-icon">💬</span>
            </button>
            <button
              className={`pp-action pp-action-retweet ${isRetweeted ? 'active' : ''}`}
              onClick={handleRetweet}
            >
              <span className="pp-action-icon">🔄</span>
            </button>
            <button
              className={`pp-action pp-action-like ${isLiked ? 'active' : ''}`}
              onClick={handleLike}
            >
              <span className="pp-action-icon">{isLiked ? '❤️' : '🤍'}</span>
            </button>
          </div>
        </article>

        {user && (
          <div className="pp-compose">
            <img
              src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.username}`}
              alt="Your avatar"
              className="avatar avatar-md"
            />
            <div className="pp-compose-body">
              <textarea
                ref={textareaRef}
                className="pp-compose-input"
                placeholder={t('post_page.comment_placeholder')}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={280}
                rows={2}
              />
              {replyError && <div className="pp-compose-error">{replyError}</div>}
              <div className="pp-compose-footer">
                <span className="pp-compose-count">{replyText.length}/280</span>
                <button
                  className="pp-compose-btn"
                  onClick={handleReplySubmit}
                  disabled={!replyText.trim() || submitting}
                >
                  {submitting ? t('post_page.comment_submitting') : t('post_page.comment_submit')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pp-replies">
          {replies.length === 0
            ? <div className="pp-no-comments">{t('post_page.no_comments')}</div>
            : replies.map((reply) => (
                <Post key={reply.id} post={reply} onDelete={handleReplyDeleted} />
              ))
          }
        </div>
      </main>
      <MobileNav />
    </div>
  );
};

export default PostPage;
