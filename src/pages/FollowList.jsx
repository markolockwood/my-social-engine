import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usersAPI, authAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import UserCard from '@/components/user/UserCard';
import UserDisplayName from '@/components/user/UserDisplayName';
import './FollowList.css';

const FollowList = () => {
  const { username, tab } = useParams(); // tab: 'followers' or 'following' or 'requests'
  const navigate = useNavigate();
  const { user: authUser, t } = useAuth();

  const [profileUser, setProfileUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [requestsCount, setRequestsCount] = useState(0);

  const offsetRef = useRef(0);
  const loaderRef = useRef(null);

  const activeTab = tab || 'followers';
  const isOwnProfile = authUser && username === authUser.username;

  useEffect(() => {
    // Сброс при смене пользователя или таба
    offsetRef.current = 0;
    setUsers([]);
    setHasMore(true);
    loadProfile();

    // Загружаем счётчик запросов если это свой профиль
    if (isOwnProfile) {
      loadRequestsCount();
    }

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

  const loadRequestsCount = async () => {
    try {
      const res = await authAPI.getFollowRequestsCount();
      setRequestsCount(res.data.count || 0);
    } catch (err) {
      console.error('Failed to load requests count', err);
    }
  };

  const loadUsers = async (isInitial) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      // Если вкладка "requests" - загружаем запросы на подписку
      if (activeTab === 'requests') {
        const res = await authAPI.getFollowRequests();
        setUsers(res.data.requests || []);
        setHasMore(false); // Запросы не пагинируются
        setLoading(false);
        setLoadingMore(false);
        return;
      }

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

  const handleAcceptRequest = async (username) => {
    try {
      await authAPI.acceptFollowRequest(username);
      setUsers(prev => prev.filter(u => u.username !== username));
      setRequestsCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to accept request', err);
      alert('Failed to accept request');
    }
  };

  const handleDeclineRequest = async (username) => {
    try {
      await authAPI.declineFollowRequest(username);
      setUsers(prev => prev.filter(u => u.username !== username));
      setRequestsCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to decline request', err);
      alert('Failed to decline request');
    }
  };

  if (loading && users.length === 0) {
    return (
      <main className="main">
        <div className="loading-container">
          <div className="loading-spinner">{t('follow_list.loading')}</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main">
        <div className="error-container">{error}</div>
      </main>
    );
  }

  return (
    <>
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
          {isOwnProfile && requestsCount > 0 && (
            <div
              className={`follow-list-tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => handleTabChange('requests')}
            >
              {t('follow_list.requests')}
              <span className="follow-list-badge">{requestsCount > 99 ? '99+' : requestsCount}</span>
            </div>
          )}
        </div>

        {users.length === 0 && !loading ? (
          <div className="empty-state">
            <p>
              {activeTab === 'requests'
                ? t('follower_requests.empty')
                : activeTab === 'followers'
                ? t('follow_list.no_followers')
                : t('follow_list.no_following')}
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'requests' ? (
              // Отображение запросов с кнопками Accept/Decline
              users.map(user => (
                <div key={user.id} className="follower-request-item">
                  <img
                    src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.username}`}
                    alt={user.display_name}
                    className="follower-request-avatar"
                    onClick={() => navigate(`/profile/${user.username}`)}
                  />
                  <div className="follower-request-info">
                    <div className="follower-request-name" onClick={() => navigate(`/profile/${user.username}`)}>
                      <UserDisplayName
                        displayName={user.display_name}
                        isProtected={user.protected_posts}
                      />
                    </div>
                    <div className="follower-request-username">@{user.username}</div>
                    {user.bio && <div className="follower-request-bio">{user.bio}</div>}
                  </div>
                  <div className="follower-request-actions">
                    <button
                      className="follower-request-btn follower-request-btn-decline"
                      onClick={() => handleDeclineRequest(user.username)}
                    >
                      {t('follower_requests.decline')}
                    </button>
                    <button
                      className="follower-request-btn follower-request-btn-accept"
                      onClick={() => handleAcceptRequest(user.username)}
                    >
                      {t('follower_requests.accept')}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              // Обычное отображение для followers/following
              users.map(user => (
                <UserCard
                  key={user.id}
                  user={user}
                  onFollowChange={handleFollowChange}
                />
              ))
            )}

            {hasMore && activeTab !== 'requests' && (
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
    </>
  );
};

export default FollowList;
