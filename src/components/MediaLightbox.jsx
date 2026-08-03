import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from './VideoPlayer';
import Post from './Post';
import ComposeWidget from './ComposeWidget';
import ComposeReplyModal from './ComposeReplyModal';
import '../styles/ImageLightbox.css';

const MediaLightbox = ({ media, initialIndex, post, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(parseInt(post.likes_count) || 0);
  const [commentsCount, setCommentsCount] = useState(parseInt(post.comments_count) || 0);
  const [loading, setLoading] = useState(false);
  const [postDetails, setPostDetails] = useState(null);
  const [replies, setReplies] = useState([]);
  const [showQuickReply, setShowQuickReply] = useState(false);
  const { user, t } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPostData = async () => {
      try {
        const [postResponse, repliesResponse] = await Promise.all([
          postsAPI.getById(post.id),
          postsAPI.getReplies(post.id)
        ]);
        setPostDetails(postResponse.data.post);
        setReplies(repliesResponse.data.posts || []);
      } catch (err) {
        console.error('Failed to load post details', err);
      }
    };
    fetchPostData();
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

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user || loading) return;
    setLoading(true);
    try {
      if (isLiked) {
        await postsAPI.unlike(post.id);
        setIsLiked(false);
        setLikesCount(n => n - 1);
      } else {
        await postsAPI.like(post.id);
        setIsLiked(true);
        setLikesCount(n => n + 1);
      }
    } catch (err) {
      console.error('like error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReplyDeleted = (replyId) => {
    setReplies(replies.filter(r => r.id !== replyId));
    setCommentsCount(n => Math.max(0, n - 1));
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
          setCommentsCount(n => n + 1);
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
                <span><b>{formatNumber(postDetails.views_count)}</b> {t('post_page.views')}</span>
              </div>

              <div className="lightbox-post-stats-row">
                <div className="lightbox-stat">
                  <b>{formatNumber(commentsCount)}</b> {t('post_page.comments_count')}
                </div>
                <div className="lightbox-stat">
                  <b>{formatNumber(likesCount)}</b> {t('post_page.likes_count')}
                </div>
              </div>

              <ComposeWidget
                parentPost={postDetails}
                onSuccess={(reply) => {
                  setReplies(prev => [...prev, reply]);
                  setCommentsCount(n => n + 1);
                }}
              />

              <div className="lightbox-replies">
                {replies.length === 0 ? (
                  <div className="lightbox-no-replies">{t('post_page.no_comments')}</div>
                ) : (
                  replies.map((reply) => (
                    <Post key={reply.id} post={reply} onDelete={handleReplyDeleted} />
                  ))
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
