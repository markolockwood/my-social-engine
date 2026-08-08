import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import UserLink from './UserLink';
import '../styles/UserCard.css';

const UserCard = ({ user, onFollowChange }) => {
  const { user: authUser, t } = useAuth();
  const [isFollowing, setIsFollowing] = useState(user.is_following || false);
  const [loading, setLoading] = useState(false);

  const isOwnProfile = authUser && authUser.username === user.username;

  const handleFollowToggle = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);

      if (isFollowing) {
        await usersAPI.unfollow(user.username);
        setIsFollowing(false);
      } else {
        await usersAPI.follow(user.username);
        setIsFollowing(true);
      }

      if (onFollowChange) {
        onFollowChange(user.username, !isFollowing);
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-card">
      <Link to={`/profile/${user.username}`} className="user-card-avatar">
        <img
          src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.username}`}
          alt={user.display_name}
        />
      </Link>

      <div className="user-card-content">
        <div className="user-card-header">
          <UserLink username={user.username} className="user-card-names">
            <div className="user-card-name">{user.display_name}</div>
            <div className="user-card-username">@{user.username}</div>
          </UserLink>

          {!isOwnProfile && (
            <button
              className={`user-card-follow-btn ${isFollowing ? 'following' : ''}`}
              onClick={handleFollowToggle}
              disabled={loading}
            >
              {loading ? '...' : isFollowing ? t('profile.unfollow') : t('profile.follow')}
            </button>
          )}
        </div>

        {user.bio && <div className="user-card-bio">{user.bio}</div>}
      </div>
    </div>
  );
};

export default UserCard;
