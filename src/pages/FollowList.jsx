import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usersAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import UserCard from '../components/UserCard';
import '../styles/FollowList.css';

const FollowList = () => {
  const { username, tab } = useParams(); // tab: 'followers' or 'following'
  const navigate = useNavigate();
  const { t } = useAuth();

  const [profileUser, setProfileUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const offsetRef = useRef(0);
  const loaderRef = useRef(null);

  const activeTab = tab || 'followers';

  useEffect(() => {
    // Сброс при смене пользователя или таба
    offsetRef.current = 0;
    setUsers([]);
    setHasMore(true);
    loadProfile();
    loadUsers(true);
  }, [username, activeTab]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadUsers(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [hasMore, loadingMore, loading]);

  const loadProfile = async () => {
    try {
      const res = await usersAPI.getByUsername(username);
      setProfileUser(res.data.user);
    } catch (err) {
      console.error('Profile load error:', err);
      setError(t('profile.not_found'));
    }
  };

  const loadUsers = async (isInitial) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const limit = isInitial ? 40 : 30;
      const offset = isInitial ? 0 : offsetRef.current;

      const res = activeTab === 'followers'
        ? await usersAPI.getFollowers(username, limit, offset)
        : await usersAPI.getFollowing(username, limit, offset);

      const newUsers = res.data.followers || res.data.following || [];

      if (isInitial) {
        setUsers(newUsers);
        offsetRef.current = newUsers.length;
      } else {
        setUsers(prev => [...prev, ...newUsers]);
        offsetRef.current += newUsers.length;
      }

      // Если получили меньше чем запросили, значит больше нет
      if (newUsers.length < limit) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Load users error:', err);
      setError(t('follow_list.error'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    navigate(`/profile/${username}/${newTab}`);
  };

  const handleFollowChange = (changedUsername, nowFollowing) => {
    // Обновляем is_following в списке
    setUsers(prev =>
      prev.map(u =>
        u.username === changedUsername
          ? { ...u, is_following: nowFollowing }
          : u
      )
    );
  };

  if (loading && users.length === 0) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main">
          <div className="loading-container">
            <div className="loading-spinner">{t('follow_list.loading')}</div>
          </div>
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
          <div className="error-container">{error}</div>
        </main>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar />

      <main className="main">
        {profileUser && (
          <div className="main-header">
            <Link to={`/profile/${username}`} className="back-button">←</Link>
            <div>
              <h2>{profileUser.display_name}</h2>
              <div className="follow-list-subtitle">@{profileUser.username}</div>
            </div>
          </div>
        )}

        <div className="follow-list-tabs">
          <div
            className={`follow-list-tab ${activeTab === 'followers' ? 'active' : ''}`}
            onClick={() => handleTabChange('followers')}
          >
            {t('follow_list.followers')}
          </div>
          <div
            className={`follow-list-tab ${activeTab === 'following' ? 'active' : ''}`}
            onClick={() => handleTabChange('following')}
          >
            {t('follow_list.following')}
          </div>
        </div>

        {users.length === 0 && !loading ? (
          <div className="empty-state">
            <p>{activeTab === 'followers' ? t('follow_list.no_followers') : t('follow_list.no_following')}</p>
          </div>
        ) : (
          <>
            {users.map(user => (
              <UserCard
                key={user.id}
                user={user}
                onFollowChange={handleFollowChange}
              />
            ))}

            {hasMore && (
              <div ref={loaderRef} className="load-more-trigger">
                {loadingMore && <div className="loading-spinner">{t('follow_list.loading_more')}</div>}
              </div>
            )}
          </>
        )}
      </main>

      <aside className="right">
        <div className="search-box">🔍 {t('feed.search')}</div>
      </aside>

      <MobileNav />
    </div>
  );
};

export default FollowList;
