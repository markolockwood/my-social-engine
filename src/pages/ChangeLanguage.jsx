import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import '../styles/ChangeUsername.css';

const ChangeLanguage = ({ embedded = false }) => {
  const { user, language, changeLanguage, t } = useAuth();
  const navigate = useNavigate();
  const [selectedLang, setSelectedLang] = useState(language);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedLang === language) {
      navigate(-1);
      return;
    }

    setLoading(true);
    try {
      await changeLanguage(selectedLang);
      navigate('/settings/account/info');
    } catch (err) {
      console.error('Failed to change language', err);
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      <div className="main-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{t('settings.language.title')}</h2>
      </div>

      <div className="change-form-container">
        <p className="change-form-desc">{t('settings.language.description')}</p>

        <form onSubmit={handleSubmit} className="change-form">
          <div className="change-form-radio-group">
            <label className={`change-form-radio-item${selectedLang === 'en' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="language"
                value="en"
                checked={selectedLang === 'en'}
                onChange={(e) => setSelectedLang(e.target.value)}
                disabled={loading}
              />
              <span className="change-form-radio-label">English</span>
            </label>

            <label className={`change-form-radio-item${selectedLang === 'ru' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="language"
                value="ru"
                checked={selectedLang === 'ru'}
                onChange={(e) => setSelectedLang(e.target.value)}
                disabled={loading}
              />
              <span className="change-form-radio-label">Русский</span>
            </label>
          </div>

          <button type="submit" className="change-form-btn" disabled={loading}>
            {loading ? t('settings.language.saving') : t('settings.language.save')}
          </button>
        </form>
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        {content}
      </main>
      <MobileNav />
    </div>
  );
};

export default ChangeLanguage;
