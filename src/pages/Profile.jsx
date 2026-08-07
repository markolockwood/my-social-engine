import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usersAPI, postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import Post from '../components/Post';
import QuotedPost from '../components/QuotedPost';
import EditProfileModal from '../components/EditProfileModal';
import '../styles/Profile.css';

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
      setProfileUser(userRes.data.user);
      setPosts(postsRes.data.posts || []);
      setReplies([]);
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
        setReplies(res.data.replies);
      } catch { setReplies([]); }
    }
  };

  const handlePostDeleted   = (id) => setPosts((p) => p.filter((x) => x.id !== id));
  const handleReplyDeleted  = (id) => setReplies((r) => r.filter((x) => x.reply.id !== id));

  const handleProfileSaved = (updatedUser) => {
    setProfileUser((prev) => ({ ...prev, ...updatedUser }));
    if (isOwn) updateUser(updatedUser);
  };

  const formatJoined    = (ts)   => new Date(ts).toLocaleDateString(t('locale'), { year: 'numeric', month: 'long' });
  const formatBirthDate = (date) => date
    ? new Date(date).toLocaleDateString(t('locale'), { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  if (loading) return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <div className="loading-container"><div className="loading-spinner">{t('profile.loading')}</div></div>
      </main>
      <MobileNav />
    </div>
  );

  if (error) return (
    <div className="layout">
      <Sidebar />
      <main className="main"><div className="error-container">{error}</div></main>
      <MobileNav />
    </div>
  );

  return (
    <div className="layout">
      <Sidebar />

      <main className="main">
        <div className="main-header">
          <h2>{profileUser.display_name}</h2>
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

          {isOwn && (
            <button className="profile-edit-btn" onClick={() => setEditOpen(true)}>
              {t('edit_profile.button')}
            </button>
          )}

          <div className="profile-name">{profileUser.display_name}</div>
          <div className="profile-handle">@{profileUser.username}</div>

          {profileUser.bio && <div className="profile-bio">{profileUser.bio}</div>}

          <div className="profile-meta">
            {profileUser.location   && <span>📍 {profileUser.location}</span>}
            {profileUser.birth_date && <span>🎂 {formatBirthDate(profileUser.birth_date)}</span>}
            <span>📅 {t('profile.joined')} {formatJoined(profileUser.created_at)}</span>
          </div>

          <div className="profile-stats">
            <span><b>{profileUser.following_count}</b> <span>{t('profile.following')}</span></span>
            <span><b>{profileUser.followers_count}</b> <span>{t('profile.followers')}</span></span>
          </div>
        </div>

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

        {tab === 'posts' && (
          posts.length === 0
            ? <div className="empty-state"><p>{t('profile.empty')}</p></div>
            : posts
                .filter((p) => !p.parent_id || p.is_quick_reply === '1' || p.is_quick_reply === true)
                .map((p) => (
                  <PostWithMeta key={p.id} post={p} currentUsername={profileUser.username} onDelete={handlePostDeleted} />
                ))
        )}

        {tab === 'replies' && (
          replies.length === 0
            ? <div className="empty-state"><p>{t('profile.empty_replies')}</p></div>
            : replies.map((item) => (
                <ReplyThread
                  key={item.reply.id}
                  item={item}
                  onDelete={handleReplyDeleted}
                />
              ))
        )}

        {(tab === 'media' || tab === 'likes') && (
          <div className="empty-state"><p>Скоро</p></div>
        )}
      </main>

      <aside className="right">
        <div className="search-box">🔍 {t('feed.search')}</div>
      </aside>

      <MobileNav />

      {editOpen && (
        <EditProfileModal
          user={profileUser}
          onClose={() => setEditOpen(false)}
          onSave={handleProfileSaved}
        />
      )}
    </div>
  );
};

export default Profile;
