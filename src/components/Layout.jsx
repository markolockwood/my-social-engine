import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

// Общий каркас приватных страниц: сайдбар + контент страницы (через Outlet) + мобильная навигация.
// Рендерится один раз на уровне роутинга, поэтому Sidebar/MobileNav не перемонтируются при переходах
// между страницами внутри Layout (раньше каждая страница рисовала их сама).
//
// Settings использует собственную двухколоночную структуру без правой колонки, поэтому получает
// класс settings-layout, переопределяющий grid-template-columns из App.css.
const Layout = () => {
  const location = useLocation();
  const isSettings = location.pathname.startsWith('/settings');

  return (
    <div className={`layout${isSettings ? ' settings-layout' : ''}`}>
      <Sidebar />
      <Outlet />
      <MobileNav />
    </div>
  );
};

export default Layout;
