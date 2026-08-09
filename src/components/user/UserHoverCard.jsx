import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import './UserHoverCard.css';

const UserHoverCard = ({ username, position, onMouseEnter, onMouseLeave }) => {
  const { user: authUser, t } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const cardRef = useRef(null);

  const isOwnProfile = authUser && authUser.username === username;

  useEffect(() => {
    loadUserData();
  }, [username]);

  // React регистрирует onWheel как passive-обработчик, из-за чего
  // preventDefault() в нём браузер игнорирует. Навешиваем нативный
  // listener с passive: false, чтобы скролл страницы блокировался,
  // пока курсор находится над карточкой.
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;

    const handleWheel = (e) => e.preventDefault();
    node.addEventListener('wheel', handleWheel, { passive: false });

    return () => node.removeEventListener('wheel', handleWheel);
  }, [loading]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const res = await usersAPI.getByUsername(username);
      setUserData(res.data.user);
      setIsFollowing(res.data.user.is_following || false);
    } catch (err) {
      console.error('Failed to load user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (followLoading) return;

    try {
      setFollowLoading(true);

      if (isFollowing) {
        await usersAPI.unfollow(username);
        setIsFollowing(false);
        setUserData(prev => ({
          ...prev,
          followers_count: Math.max(0, parseInt(prev.followers_count) - 1)
        }));
      } else {
        await usersAPI.follow(username);
        setIsFollowing(true);
        setUserData(prev => ({
          ...prev,
          followers_count: parseInt(prev.followers_count) + 1
        }));
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        ref={cardRef}
        className="user-hover-card"
        style={{ left: position.x, top: position.y }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="user-hover-card-loading">{t('follow_list.loading')}</div>
      </div>
    );
  }

  if (!userData) return null;

  return (
    <div
      ref={cardRef}
      className="user-hover-card"
      style={{ left: position.x, top: position.y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="user-hover-card-header">
        <Link
          to={`/profile/${username}`}
          className="user-hover-card-avatar"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={userData.avatar_url || `https://i.pravatar.cc/150?u=${username}`}
            alt={userData.display_name}
          />
        </Link>

        {!isOwnProfile && (
          <button
            className={`user-hover-card-follow-btn ${isFollowing ? 'following' : ''}`}
            onClick={handleFollowToggle}
            disabled={followLoading}
          >
            {followLoading ? '...' : isFollowing ? t('profile.unfollow') : t('profile.follow')}
          </button>
        )}
      </div>

      <Link
        to={`/profile/${username}`}
        className="user-hover-card-info"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="user-hover-card-name">{userData.display_name}</div>
        <div className="user-hover-card-username">@{userData.username}</div>
      </Link>

      {userData.bio && (
        <div className="user-hover-card-bio">{userData.bio}</div>
      )}

      <div className="user-hover-card-stats">
        <Link
          to={`/profile/${username}/following`}
          className="user-hover-card-stat"
          onClick={(e) => e.stopPropagation()}
        >
          <b>{userData.following_count}</b> <span>{t('profile.following')}</span>
        </Link>
        <Link
          to={`/profile/${username}/followers`}
          className="user-hover-card-stat"
          onClick={(e) => e.stopPropagation()}
        >
          <b>{userData.followers_count}</b> <span>{t('profile.followers')}</span>
        </Link>
      </div>
    </div>
  );
};

export default UserHoverCard;
