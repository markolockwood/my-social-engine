import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const { user, logout, theme, toggleTheme, language, changeLanguage, t } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm(t('auth.logout_confirm'))) {
      logout();
      navigate('/login');
    }
  };

  return (
    <aside className="sidebar">
      <div className="logo">M</div>

      <nav className="nav">
        <Link to="/" className="nav-item">
          <span className="nav-icon">🏠</span>
          <span>{t('nav.home')}</span>
        </Link>
        <Link to="/explore" className="nav-item">
          <span className="nav-icon">🔍</span>
          <span>{t('nav.search')}</span>
        </Link>
        <Link to="/notifications" className="nav-item">
          <span className="nav-icon">🔔</span>
          <span>{t('nav.notifications')}</span>
        </Link>
        <Link to="/messages" className="nav-item">
          <span className="nav-icon">✉️</span>
          <span>{t('nav.messages')}</span>
        </Link>
        <Link to={`/profile/${user?.username}`} className="nav-item">
          <span className="nav-icon">👤</span>
          <span>{t('nav.profile')}</span>
        </Link>
        <Link to="/settings" className="nav-item">
          <span className="nav-icon">⚙️</span>
          <span>{t('nav.settings')}</span>
        </Link>
      </nav>

      <button className="tweet-btn">
        <span className="tweet-btn-label">{t('nav.post')}</span>
      </button>

      <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
        <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
        <span>{theme === 'dark' ? t('theme.to_light') : t('theme.to_dark')}</span>
      </button>

      <button
        className="theme-toggle"
        onClick={() => changeLanguage(language === 'en' ? 'ru' : 'en')}
        title="Change language"
      >
        <span className="nav-icon">🌐</span>
        <span>{t('lang.switch')}</span>
      </button>

      <div className="sidebar-user" onClick={handleLogout}>
        <img
          src={user?.avatar_url || `https://i.pravatar.cc/150?u=${user?.username}`}
          alt="Avatar"
          className="avatar avatar-sm"
        />
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.display_name}</div>
          <div className="sidebar-user-handle">@{user?.username}</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
