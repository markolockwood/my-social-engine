import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/api';
import '../styles/ChangeUsername.css';

const ChangeUsername = () => {
  const { user, setUser, t } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Валидация
    if (username.length < 3 || username.length > 50) {
      setError(t('settings.username.error_length'));
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError(t('settings.username.error_format'));
      return;
    }

    if (username === user?.username) {
      navigate(-1);
      return;
    }

    setLoading(true);
    try {
      await authAPI.updateUsername(username);

      // Обновляем локальные данные пользователя
      const updatedUser = { ...user, username };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      navigate('/settings/account/info');
    } catch (err) {
      setError(err.response?.data?.error || t('settings.username.error_taken'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="main-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{t('settings.username.title')}</h2>
      </div>

      <div className="change-form-container">
        <p className="change-form-desc">{t('settings.username.description')}</p>

        <form onSubmit={handleSubmit} className="change-form">
          <div className="change-form-field">
            <label className="change-form-label">{t('settings.username.label')}</label>
            <input
              type="text"
              className="change-form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder={t('settings.username.placeholder')}
              maxLength={50}
              disabled={loading}
            />
            <div className="change-form-hint">@{username || t('settings.username.placeholder')}</div>
          </div>

          {error && <div className="change-form-error">{error}</div>}

          <button type="submit" className="change-form-btn" disabled={loading || !username}>
            {loading ? t('settings.username.saving') : t('settings.username.save')}
          </button>
        </form>
      </div>
    </>
  );
};

export default ChangeUsername;
