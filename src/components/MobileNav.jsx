import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/MobileNav.css';

const MobileNav = () => {
  const { user } = useAuth();
  const location = useLocation();

  const active = (path) => location.pathname === path ? 'mobile-nav-item active' : 'mobile-nav-item';

  return (
    <nav className="mobile-nav">
      <Link to="/" className={active('/')}>🏠</Link>
      <Link to="/explore" className={active('/explore')}>🔍</Link>
      <Link to="/notifications" className={active('/notifications')}>🔔</Link>
      <Link to={`/profile/${user?.username}`} className={active(`/profile/${user?.username}`)}>👤</Link>
    </nav>
  );
};

export default MobileNav;
