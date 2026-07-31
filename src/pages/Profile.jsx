import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { usersAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import Post from '../components/Post';
import '../styles/Profile.css';

const Profile = () => {
  const { username }  = useParams();
  const [user, setUser]     = useState(null);
  const [posts, setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const { t } = useAuth();

  useEffect(() => { loadProfile(); }, [username]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [userResponse, postsResponse] = await Promise.all([
        usersAPI.getByUsername(username),
        usersAPI.getUserPosts(username)
      ]);
      setUser(userResponse.data.user);
      setPosts(postsResponse.data.posts);
    } catch (err) {
      setError(t('profile.not_found'));
    } finally {
      setLoading(false);
    }
  };

  const handlePostDeleted = (postId) => setPosts(posts.filter((p) => p.id !== postId));

  const formatDate = (ts) =>
    new Date(ts).toLocaleDateString(t('locale'), { year: 'numeric', month: 'long' });

  if (loading) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main">
          <div className="loading-container"><div className="loading-spinner">{t('profile.loading')}</div></div>
        </main>
        <MobileNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main"><div className="error-container">{error}</div></main>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar />

      <main className="main">
        <div className="main-header">
          <h2>{user.display_name}</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
            {user.posts_count} {t('profile.posts_count')}
          </div>
        </div>

        <div className="profile-banner"></div>

        <div className="profile-head">
          <img
            src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.username}`}
            alt="Avatar"
            className="profile-avatar"
          />

          <div className="profile-name">{user.display_name}</div>
          <div className="profile-handle">@{user.username}</div>

          {user.bio && <div className="profile-bio">{user.bio}</div>}

          <div className="profile-meta">
            <span>📅 {t('profile.joined')} {formatDate(user.created_at)}</span>
          </div>

          <div className="profile-stats">
            <span><b>{user.following_count}</b> <span>{t('profile.following')}</span></span>
            <span><b>{user.followers_count}</b> <span>{t('profile.followers')}</span></span>
          </div>
        </div>

        <div className="profile-tabs">
          <div className="profile-tab active">{t('profile.tab_posts')}</div>
          <div className="profile-tab">{t('profile.tab_replies')}</div>
          <div className="profile-tab">{t('profile.tab_media')}</div>
          <div className="profile-tab">{t('profile.tab_likes')}</div>
        </div>

        {posts.length === 0 ? (
          <div className="empty-state"><p>{t('profile.empty')}</p></div>
        ) : (
          posts.map((post) => <Post key={post.id} post={post} onDelete={handlePostDeleted} />)
        )}
      </main>

      <aside className="right">
        <div className="search-box">🔍 {t('feed.search')}</div>
      </aside>

      <MobileNav />
    </div>
  );
};

export default Profile;
