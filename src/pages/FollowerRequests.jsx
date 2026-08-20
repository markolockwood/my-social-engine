import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/api/api';
import UserDisplayName from '@/components/user/UserDisplayName';
import './FollowerRequests.css';

const FollowerRequests = () => {
  const { t } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await authAPI.getFollowRequests();
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error('Failed to load follow requests', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (username) => {
    try {
      await authAPI.acceptFollowRequest(username);
      setRequests(prev => prev.filter(req => req.username !== username));
    } catch (err) {
      console.error('Failed to accept request', err);
      alert('Failed to accept request');
    }
  };

  const handleDecline = async (username) => {
    try {
      await authAPI.declineFollowRequest(username);
      setRequests(prev => prev.filter(req => req.username !== username));
    } catch (err) {
      console.error('Failed to decline request', err);
      alert('Failed to decline request');
    }
  };

  if (loading) {
    return (
      <main className="main">
        <div className="main-header">
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <h2>{t('follower_requests.title')}</h2>
        </div>
        <div className="loading-container">
          <div className="loading-spinner">{t('profile.loading')}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="main-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{t('follower_requests.title')}</h2>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <p>{t('follower_requests.empty')}</p>
        </div>
      ) : (
        <div className="follower-requests-list">
          {requests.map((request) => (
            <div key={request.id} className="follower-request-item">
              <img
                src={request.avatar_url || `https://i.pravatar.cc/150?u=${request.username}`}
                alt={request.display_name}
                className="follower-request-avatar"
                onClick={() => navigate(`/profile/${request.username}`)}
              />

              <div className="follower-request-info">
                <div className="follower-request-name" onClick={() => navigate(`/profile/${request.username}`)}>
                  <UserDisplayName
                    displayName={request.display_name}
                    isProtected={request.protected_posts}
                  />
                </div>
                <div className="follower-request-username">@{request.username}</div>
                {request.bio && <div className="follower-request-bio">{request.bio}</div>}
              </div>

              <div className="follower-request-actions">
                <button
                  className="follower-request-btn follower-request-btn-decline"
                  onClick={() => handleDecline(request.username)}
                >
                  {t('follower_requests.decline')}
                </button>
                <button
                  className="follower-request-btn follower-request-btn-accept"
                  onClick={() => handleAccept(request.username)}
                >
                  {t('follower_requests.accept')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default FollowerRequests;
