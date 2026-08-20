import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usersAPI, postsAPI, authAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import Post from '@/components/post/Post';
import QuotedPost from '@/components/post/QuotedPost';
import EditProfileModal from '@/components/user/EditProfileModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import UserDisplayName from '@/components/user/UserDisplayName';
import './Profile.css';

/**
 * Вспомогательный компонент для отображения постов с метаданными в табе "Посты"
 * Обрабатывает 3 типа постов:
 * 1. Ретвиты - показывает "Вы ретвитнули" сверху
 * 2. Быстрые ответы (is_quick_reply) - загружает и показывает quoted post
 * 3. Обычные посты - показывает как есть
 */
const PostWithMeta = ({ post, currentUsername, onDelete }) => {
  const { t } = useAuth();
  const [parentPost, setParentPost] = useState(null);

  // Для быстрых ответов загружаем родительский пост (quoted post)
  useEffect(() => {
    if (post.is_quick_reply && post.parent_id) {
      postsAPI.getById(post.parent_id).then(res => {
        setParentPost(res.data.post);
      }).catch(() => setParentPost(null));
    }
  }, [post.id]);

  // Ретвит - показываем индикатор "Вы ретвитнули" сверху
  if (post.is_retweet === '1' || post.is_retweet === true) {
    return (
      <div className="post-meta-wrapper">
        <div className="post-meta-header">
          <span className="post-meta-icon">🔄</span>
          <span className="post-meta-text">{currentUsername === post.username ? t('profile.you_retweeted') : t('profile.retweeted')}</span>
        </div>
        <Post post={post} onDelete={onDelete} />
      </div>
    );
  }

  // Быстрый ответ - передаём quoted post в компонент Post
  if (post.is_quick_reply && post.parent_id) {
    return (
      <div className="post-meta-wrapper">
        <Post post={post} quotedPost={parentPost} onDelete={onDelete} />
      </div>
    );
  }

  // Обычный пост
  return <Post post={post} onDelete={onDelete} />;
};

/**
 * Компонент для отображения ответа с родительским постом в табе "Ответы"
 * Показывает полный тред: родительский пост → линия → ответ пользователя
 */
const ReplyThread = ({ item, onDelete }) => {
  const { t } = useAuth();
  const { reply, parent } = item;

  return (
    <div className="reply-thread">
      {parent ? (
        <div className="reply-thread-parent">
          <Post post={parent} />
        </div>
      ) : (
        <div className="reply-thread-no-parent">
          <span className="reply-thread-label">
            {t('profile.reply_to')}{' '}
            {reply.parent_username
              ? <Link to={`/profile/${reply.parent_username}`}>@{reply.parent_username}</Link>
              : <span>@deleted</span>
            }
          </span>
          <div className="reply-thread-connector" />
        </div>
      )}
      <Post post={reply} onDelete={onDelete} />
    </div>
  );
};

const Profile = () => {
  const { username }  = useParams();
  const [profileUser, setProfileUser] = useState(null);
  const [posts,    setPosts]    = useState([]);
  const [replies,  setReplies]  = useState([]);
  const [tab,      setTab]      = useState('posts');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [postsProtected, setPostsProtected] = useState(false);
  const [repliesProtected, setRepliesProtected] = useState(false);
  const [followStatus, setFollowStatus] = useState('none'); // 'following' | 'pending' | 'none'
  const [showCancelModal, setShowCancelModal] = useState(false);
  const { user: authUser, updateUser, t } = useAuth();

  const isOwn = authUser && profileUser && authUser.username === profileUser.username;

  useEffect(() => {
    setTab('posts');
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [userRes, postsRes] = await Promise.all([
        usersAPI.getByUsername(username),
        usersAPI.getUserPosts(username),
      ]);

      // Проверка что данные пользователя загрузились
      if (!userRes.data || !userRes.data.user) {
        throw new Error('User data not found');
      }

      setProfileUser(userRes.data.user);
      setIsFollowing(userRes.data.user.is_following || false);
      setFollowStatus(userRes.data.user.follow_status || 'none');
      setPosts(postsRes.data.posts || []);
      setPostsProtected(postsRes.data.protected || false);
      setReplies([]);
      setRepliesProtected(false);
    } catch (err) {
      console.error('Profile load error:', err);
      setError(t('profile.not_found'));
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = async (next) => {
    if (next === tab) return;
    setTab(next);
    if (next === 'replies' && replies.length === 0) {
      try {
        const res = await usersAPI.getUserReplies(username);
        setReplies(res.data.replies || []);
        setRepliesProtected(res.data.protected || false);
      } catch {
        setReplies([]);
        setRepliesProtected(false);
      }
    }
  };

  const handlePostDeleted   = (id) => setPosts((p) => p.filter((x) => x.id !== id));
  const handleReplyDeleted  = (id) => setReplies((r) => r.filter((x) => x.reply.id !== id));

  const handleProfileSaved = (updatedUser) => {
    setProfileUser((prev) => ({ ...prev, ...updatedUser }));
    if (isOwn) updateUser(updatedUser);
  };

  const handleFollowToggle = async () => {
    if (followLoading || !profileUser) return;

    // Если статус pending - показываем модальное окно подтверждения
    if (followStatus === 'pending') {
      setShowCancelModal(true);
      return;
    }

    try {
      setFollowLoading(true);

      if (isFollowing) {
        await usersAPI.unfollow(profileUser.username);
        setIsFollowing(false);
        setFollowStatus('none');
        setProfileUser(prev => ({
          ...prev,
          followers_count: Math.max(0, parseInt(prev.followers_count) - 1)
        }));
      } else {
        const res = await usersAPI.follow(profileUser.username);
        const newStatus = res.data.follow_status || 'following';

        setFollowStatus(newStatus);

        if (newStatus === 'following') {
          setIsFollowing(true);
          setProfileUser(prev => ({
            ...prev,
            followers_count: parseInt(prev.followers_count) + 1
          }));
          // Если подписка прошла, обновляем посты
          setPostsProtected(false);
          loadProfile();
        }
        // Если pending - просто обновляем статус кнопки
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
      alert(t('profile.follow_error') || 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    try {
      setFollowLoading(true);
      await authAPI.cancelFollowRequest(profileUser.username);
      setFollowStatus('none');
      setShowCancelModal(false);
    } catch (err) {
      console.error('Cancel request error:', err);
      alert('Failed to cancel request');
    } finally {
      setFollowLoading(false);
    }
  };

  const formatJoined    = (ts)   => new Date(ts).toLocaleDateString(t('locale'), { year: 'numeric', month: 'long' });
  const formatBirthDate = (date) => date
    ? new Date(date).toLocaleDateString(t('locale'), { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  if (loading) return (
    <main className="main">
      <div className="loading-container"><div className="loading-spinner">{t('profile.loading')}</div></div>
    </main>
  );

  if (error) return (
    <main className="main"><div className="error-container">{error}</div></main>
  );

  return (
    <>
      <main className="main">
        <div className="main-header profile-main-header">
          <h2>
            <UserDisplayName
              displayName={profileUser.display_name}
              isProtected={profileUser.protected_posts}
            />
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
            {profileUser.posts_count} {t('profile.posts_count')}
          </div>
        </div>

        <div className="profile-banner"></div>

        <div className="profile-head">
          <img
            src={profileUser.avatar_url || `https://i.pravatar.cc/150?u=${profileUser.username}`}
            alt="Avatar"
            className="profile-avatar"
          />

          {isOwn ? (
            <button className="profile-edit-btn" onClick={() => setEditOpen(true)}>
              {t('edit_profile.button')}
            </button>
          ) : (
            <button
              className={`profile-follow-btn ${
                followStatus === 'following' ? 'following' :
                followStatus === 'pending' ? 'pending' : ''
              }`}
              onClick={handleFollowToggle}
              disabled={followLoading}
              onMouseEnter={(e) => {
                if (followStatus === 'following') {
                  e.target.textContent = t('profile.unfollow');
                } else if (followStatus === 'pending') {
                  e.target.textContent = t('profile.cancel_request');
                }
              }}
              onMouseLeave={(e) => {
                if (followStatus === 'following') {
                  e.target.textContent = t('profile.following_btn');
                } else if (followStatus === 'pending') {
                  e.target.textContent = t('profile.pending');
                }
              }}
            >
              {followLoading ? '...' :
               followStatus === 'following' ? t('profile.following_btn') :
               followStatus === 'pending' ? t('profile.pending') :
               t('profile.follow')}
            </button>
          )}

          <div className="profile-name">
            <UserDisplayName
              displayName={profileUser.display_name}
              isProtected={profileUser.protected_posts}
            />
          </div>
          <div className="profile-handle">@{profileUser.username}</div>

          {profileUser.bio && <div className="profile-bio">{profileUser.bio}</div>}

          <div className="profile-meta">
            {profileUser.location   && <span>📍 {profileUser.location}</span>}
            {profileUser.birth_date && <span>🎂 {formatBirthDate(profileUser.birth_date)}</span>}
            <span>📅 {t('profile.joined')} {formatJoined(profileUser.created_at)}</span>
          </div>

          <div className="profile-stats">
            <Link to={`/profile/${profileUser.username}/following`} className="profile-stat-link">
              <b>{profileUser.following_count}</b> <span>{t('profile.following')}</span>
            </Link>
            <Link to={`/profile/${profileUser.username}/followers`} className="profile-stat-link">
              <b>{profileUser.followers_count}</b> <span>{t('profile.followers')}</span>
            </Link>
          </div>
        </div>

        {/* Вкладки показываем только если посты не защищены или пользователь подписан */}
        {!postsProtected && (
          <div className="profile-tabs">
            {['posts', 'replies', 'media', 'likes'].map((key) => (
              <div
                key={key}
                className={`profile-tab${tab === key ? ' active' : ''}`}
                onClick={() => handleTabChange(key)}
              >
                {t(`profile.tab_${key}`)}
              </div>
            ))}
          </div>
        )}

        {/* Если посты защищены - показываем сообщение вместо контента */}
        {postsProtected ? (
          <div className="protected-posts-message">
            <h3>{t('profile.protected_posts_title')}</h3>
            <p>
              {t('profile.protected_posts_message', { username: profileUser.username })}{' '}
              <a href="#" className="learn-more-link">{t('settings.account_info.learn_more')}</a>
            </p>
          </div>
        ) : (
          <>
            {tab === 'posts' && (
              posts.length === 0 ? (
                <div className="empty-state"><p>{t('profile.empty')}</p></div>
              ) : (
                posts
                  .filter((p) => !p.parent_id || p.is_quick_reply === '1' || p.is_quick_reply === true)
                  .map((p) => (
                    <PostWithMeta key={p.id} post={p} currentUsername={profileUser.username} onDelete={handlePostDeleted} />
                  ))
              )
            )}

            {tab === 'replies' && (
              repliesProtected ? (
                <div className="protected-posts-message">
                  <h3>{t('profile.protected_posts_title')}</h3>
                  <p>
                    {t('profile.protected_posts_message', { username: profileUser.username })}{' '}
                    <a href="#" className="learn-more-link">{t('settings.account_info.learn_more')}</a>
                  </p>
                </div>
              ) : replies.length === 0 ? (
                <div className="empty-state"><p>{t('profile.empty_replies')}</p></div>
              ) : (
                replies.map((item) => (
                  <ReplyThread
                    key={item.reply.id}
                    item={item}
                    onDelete={handleReplyDeleted}
                  />
                ))
              )
            )}

            {(tab === 'media' || tab === 'likes') && (
              <div className="empty-state"><p>Скоро</p></div>
            )}
          </>
        )}
      </main>

      <aside className="right">
        <div className="search-box">🔍 {t('feed.search')}</div>
      </aside>

      {editOpen && (
        <EditProfileModal
          user={profileUser}
          onClose={() => setEditOpen(false)}
          onSave={handleProfileSaved}
        />
      )}

      {/* Модальное окно отмены запроса на подписку */}
      <ConfirmModal
        isOpen={showCancelModal}
        title={t('profile.cancel_request_title')}
        message={t('profile.cancel_request_message', { username: profileUser?.username })}
        confirmText={t('profile.cancel_request_confirm')}
        cancelText={t('profile.cancel_request_back')}
        onConfirm={handleCancelRequest}
        onCancel={() => setShowCancelModal(false)}
      />
    </>
  );
};

export default Profile;
