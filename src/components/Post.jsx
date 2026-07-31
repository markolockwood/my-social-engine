import React, { useState } from 'react';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import '../styles/Post.css';

const Post = ({ post, onDelete }) => {
  const [isLiked,     setIsLiked]     = useState(post.is_liked || false);
  const [likesCount,  setLikesCount]  = useState(parseInt(post.likes_count) || 0);
  const [loading,     setLoading]     = useState(false);
  const { user, t } = useAuth();

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user || loading) return;
    setLoading(true);
    try {
      if (isLiked) {
        await postsAPI.unlike(post.id);
        setIsLiked(false);
        setLikesCount((prev) => prev - 1);
      } else {
        await postsAPI.like(post.id);
        setIsLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
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
    } catch (err) {
      alert(t('post.delete_error'));
    }
  };

  const formatTime = (timestamp) => {
    const date    = new Date(timestamp);
    const now     = new Date();
    const diffMs  = now - date;
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays  = Math.floor(diffMs / 86400000);

    if (diffMins  < 1)  return t('post.time.just_now');
    if (diffMins  < 60) return `${diffMins}${t('post.time.minutes')}`;
    if (diffHours < 24) return `${diffHours}${t('post.time.hours')}`;
    if (diffDays  < 7)  return `${diffDays}${t('post.time.days')}`;

    return date.toLocaleDateString(t('locale'), { day: 'numeric', month: 'short' });
  };

  const isOwnPost = user && user.id === post.user_id;

  return (
    <article className="tweet">
      <img
        src={post.avatar_url || `https://i.pravatar.cc/150?u=${post.username}`}
        alt="Avatar"
        className="avatar avatar-md"
      />
      <div className="tweet-body">
        <div className="tweet-head">
          <span className="tweet-name">{post.display_name}</span>
          <span className="tweet-handle">@{post.username}</span>
          <span className="tweet-dot">·</span>
          <span className="tweet-time">{formatTime(post.created_at)}</span>
          {isOwnPost && (
            <button className="tweet-delete" onClick={handleDelete} title="Delete">×</button>
          )}
        </div>
        <div className="tweet-text">{post.content}</div>
        <div className="tweet-actions">
          <div className="tweet-action">
            <span>💬</span><span>{post.comments_count || 0}</span>
          </div>
          <div className="tweet-action retweet">
            <span>🔄</span><span>0</span>
          </div>
          <div
            className={`tweet-action like ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
            style={{ cursor: user ? 'pointer' : 'default' }}
          >
            <span>{isLiked ? '❤️' : '🤍'}</span>
            <span>{likesCount}</span>
          </div>
          <div className="tweet-action">
            <span>📤</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default Post;
