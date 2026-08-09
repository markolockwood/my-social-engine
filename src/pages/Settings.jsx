import React from 'react';
import { Link, useNavigate, useParams, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import AccountInformation from './AccountInformation';
import ChangeUsername from './ChangeUsername';
import ChangeCountry from './ChangeCountry';
import ChangeLanguage from './ChangeLanguage';
import ChangeGender from './ChangeGender';
import '../styles/Settings.css';

// Структура разделов настроек
const SETTINGS_SECTIONS = [
  {
    id: 'account',
    titleKey: 'settings.account.title',
    descriptionKey: 'settings.account.description',
    items: [
      { id: 'info', icon: '👤', titleKey: 'settings.account.account_info', descKey: 'settings.account.account_info_desc' },
      { id: 'change_email', icon: '✉️', titleKey: 'settings.account.change_email', descKey: 'settings.account.change_email_desc' },
      { id: 'change_password', icon: '🔑', titleKey: 'settings.account.change_password', descKey: 'settings.account.change_password_desc' },
      { id: 'deactivate', icon: '💔', titleKey: 'settings.account.deactivate', descKey: 'settings.account.deactivate_desc' },
    ],
  },
  {
    id: 'privacy',
    titleKey: 'settings.privacy.title',
    descriptionKey: 'settings.privacy.description',
    items: [
      { id: 'chat', icon: '💬', titleKey: 'settings.privacy.chat', descKey: 'settings.privacy.chat_desc' },
      { id: 'audience', icon: '🔒', titleKey: 'settings.privacy.audience', descKey: 'settings.privacy.audience_desc' },
    ],
  },
];

// Компонент для отображения списка пунктов раздела
const SectionContent = () => {
  const { t } = useAuth();
  const navigate = useNavigate();
  const { sectionId } = useParams();

  const activeSection = SETTINGS_SECTIONS.find((s) => s.id === sectionId) || SETTINGS_SECTIONS[0];

  return (
    <>
      <div className="main-header">
        <button className="back-btn settings-back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{t(activeSection.titleKey)}</h2>
      </div>

      <p className="settings-content-desc">{t(activeSection.descriptionKey)}</p>

      <div className="settings-items">
        {activeSection.items.map((item) => (
          <Link
            key={item.id}
            to={item.id}
            relative="path"
            className="settings-item"
          >
            <span className="settings-item-icon">{item.icon}</span>
            <div className="settings-item-text">
              <div className="settings-item-title">{t(item.titleKey)}</div>
              <div className="settings-item-desc">{t(item.descKey)}</div>
            </div>
            <span className="settings-chevron">›</span>
          </Link>
        ))}
      </div>
    </>
  );
};

const Settings = () => {
  const { t } = useAuth();
  const location = useLocation();

  // useParams() здесь не подходит: :sectionId объявлен во вложенных <Routes> ниже,
  // а этот компонент рендерится ВЫШЕ них, так что параметр туда не доходит.
  // location.pathname работает независимо от глубины вложенности роутов.
  const segments = location.pathname.split('/').filter(Boolean); // ['settings', 'account', ...]
  const activeId = segments[1] || SETTINGS_SECTIONS[0].id;
  const isDetailView = segments.length > 1; // есть ли что-то после /settings

  return (
    <div className="layout settings-layout">
      <Sidebar />

      <main className={`main settings-main${isDetailView ? ' settings-detail-open' : ''}`}>
        <nav className="settings-nav">
          <div className="main-header">
            <h2>{t('settings.title')}</h2>
          </div>
          <div className="settings-nav-list">
            {SETTINGS_SECTIONS.map((section) => (
              <Link
                key={section.id}
                to={`/settings/${section.id}`}
                className={`settings-nav-item${activeId === section.id ? ' active' : ''}`}
              >
                <span>{t(section.titleKey)}</span>
                <span className="settings-chevron">›</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="settings-content">
          <Routes>
            {/* Account Info подстраницы - БОЛЕЕ СПЕЦИФИЧНЫЕ РОУТЫ ПЕРВЫМИ */}
            <Route path="account/info/username" element={<ChangeUsername embedded />} />
            <Route path="account/info/country" element={<ChangeCountry embedded />} />
            <Route path="account/info/language" element={<ChangeLanguage embedded />} />
            <Route path="account/info/gender" element={<ChangeGender embedded />} />
            <Route path="account/info" element={<AccountInformation embedded />} />

            {/* Конкретный раздел выбран явно */}
            <Route path=":sectionId" element={<SectionContent />} />

            {/* /settings без раздела — по умолчанию открыт "Your account" */}
            <Route path="" element={<Navigate to="account" replace relative="path" />} />
          </Routes>
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default Settings;
