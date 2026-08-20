import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/api/api';
import ConfirmModal from '@/components/modals/ConfirmModal';
import './Settings.css';

const AudienceSettings = () => {
  const { user, updateUser, t } = useAuth();
  const navigate = useNavigate();
  const [protectedPosts, setProtectedPosts] = useState(user?.protected_posts || false);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Обработка изменения чекбокса
  const handleToggleProtection = async (checked) => {
    // Если включаем защиту - показываем подтверждение
    if (checked) {
      setShowConfirmModal(true);
      return;
    }

    // Если выключаем - сразу применяем
    await applyProtection(checked);
  };

  // Применение изменения защиты
  const applyProtection = async (checked) => {
    setProtectedPosts(checked);
    setLoading(true);

    try {
      await authAPI.updateProtectedPosts(checked);
      updateUser({ protected_posts: checked });
    } catch (err) {
      console.error('Failed to update protected posts', err);
      // Откатываем изменение при ошибке
      setProtectedPosts(!checked);
    } finally {
      setLoading(false);
    }
  };

  // Подтверждение включения защиты
  const handleConfirm = async () => {
    setShowConfirmModal(false);
    await applyProtection(true);
  };

  // Отмена включения защиты
  const handleCancel = () => {
    setShowConfirmModal(false);
    // Чекбокс остаётся в выключенном состоянии
  };

  return (
    <>
      <div className="main-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{t('settings.privacy.audience')}</h2>
      </div>

      <p className="settings-content-desc">
        {t('settings.privacy.audience_description')}
      </p>

      <div className="settings-items">
        {/* Защита постов */}
        <div className="settings-item settings-item-checkbox">
          <div className="settings-item-text">
            <div className="settings-item-title">{t('settings.privacy.protect_posts_title')}</div>
            <div className="settings-item-desc">
              {t('settings.privacy.protect_posts_desc')}{' '}
              <a href="#" className="learn-more-link">{t('settings.account_info.learn_more')}</a>
            </div>
          </div>
          <label className="settings-checkbox-wrapper">
            <input
              type="checkbox"
              checked={protectedPosts}
              onChange={(e) => handleToggleProtection(e.target.checked)}
              disabled={loading}
              className="settings-checkbox-input"
            />
            <span className="settings-checkbox"></span>
          </label>
        </div>
      </div>

      {/* Модальное окно подтверждения */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title={t('settings.privacy.protect_confirm_title')}
        message={t('settings.privacy.protect_confirm_message')}
        confirmText={t('settings.privacy.protect_confirm_btn')}
        cancelText={t('settings.privacy.protect_cancel_btn')}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

export default AudienceSettings;
