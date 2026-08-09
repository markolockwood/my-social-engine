import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/api/api';
import EditProfileModal from '@/components/user/EditProfileModal';
import './AccountInformation.css';

const AccountInformation = () => {
  const { user, t } = useAuth();
  const navigate = useNavigate();
  const [accountData, setAccountData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    try {
      const res = await authAPI.getAccountInfo();
      setAccountData(res.data);
    } catch (err) {
      console.error('Failed to load account info', err);
    } finally {
      setLoading(false);
    }
  };

  // Вычисление возраста по дате рождения
  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Форматирование даты создания аккаунта
  const formatCreationDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString(t('locale'), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Форматирование даты рождения
  const formatBirthDate = (date) => {
    if (!date) return t('settings.account_info.not_set');
    const d = new Date(date);
    return d.toLocaleDateString(t('locale'), { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">{t('feed.loading')}</div>
      </div>
    );
  }

  const age = calculateAge(accountData?.birth_date);

  return (
    <>
      <div className="main-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{t('settings.account_info.title')}</h2>
      </div>

      <div className="account-info-list">
        {/* Username */}
        <div className="account-info-item clickable" onClick={() => navigate('/settings/account/info/username')}>
          <div className="account-info-text">
            <div className="account-info-label">{t('settings.account_info.username')}</div>
            <div className="account-info-value">@{user?.username}</div>
          </div>
          <span className="settings-chevron">›</span>
        </div>

        {/* Verified */}
        <div className="account-info-item">
          <div className="account-info-text">
            <div className="account-info-label">{t('settings.account_info.verified')}</div>
            <div className="account-info-value">
              {accountData?.verified ? (
                <span className="verified-badge">✓ {t('settings.account_info.verified_yes')}</span>
              ) : (
                <span>
                  {t('settings.account_info.verified_no')}{' '}
                  <a href="#" className="learn-more-link">{t('settings.account_info.learn_more')}</a>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Account creation */}
        <div className="account-info-item">
          <div className="account-info-text">
            <div className="account-info-label">{t('settings.account_info.account_creation')}</div>
            <div className="account-info-value account-info-multiline">
              <div>{formatCreationDate(accountData?.created_at)}</div>
              {accountData?.registration_ip && (
                <div className="account-info-ip">
                  {accountData.registration_ip}
                  {accountData.registration_country && ` (${accountData.registration_country})`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Country */}
        <div className="account-info-item clickable" onClick={() => navigate('/settings/account/info/country')}>
          <div className="account-info-text">
            <div className="account-info-label">{t('settings.account_info.country')}</div>
            <div className="account-info-value">
              {accountData?.country || t('settings.account_info.not_set')}
            </div>
          </div>
          <span className="settings-chevron">›</span>
        </div>

        {/* Language */}
        <div className="account-info-item clickable" onClick={() => navigate('/settings/account/info/language')}>
          <div className="account-info-text">
            <div className="account-info-label">{t('settings.account_info.language')}</div>
            <div className="account-info-value">
              {t(`settings.account_info.language_${user?.language || 'en'}`)}
            </div>
          </div>
          <span className="settings-chevron">›</span>
        </div>

        {/* Gender */}
        <div className="account-info-item clickable" onClick={() => navigate('/settings/account/info/gender')}>
          <div className="account-info-text">
            <div className="account-info-label">{t('settings.account_info.gender')}</div>
            <div className="account-info-value">
              {accountData?.gender ?
                (accountData.gender === 'male' ? t('settings.account_info.gender_male') :
                 accountData.gender === 'female' ? t('settings.account_info.gender_female') :
                 accountData.gender) :
                t('settings.account_info.not_set')
              }
            </div>
          </div>
          <span className="settings-chevron">›</span>
        </div>

        {/* Birth date */}
        <div className="account-info-item clickable" onClick={() => setEditProfileOpen(true)}>
          <div className="account-info-text">
            <div className="account-info-label">{t('settings.account_info.birth_date')}</div>
            <div className="account-info-value account-info-multiline">
              <div>{formatBirthDate(accountData?.birth_date)}</div>
              <div className="account-info-hint">{t('settings.account_info.birth_date_hint')}</div>
            </div>
          </div>
          <span className="settings-chevron">›</span>
        </div>

        {/* Age */}
        <div className="account-info-item">
          <div className="account-info-text">
            <div className="account-info-label">{t('settings.account_info.age')}</div>
            <div className="account-info-value">
              {age !== null ? age : t('settings.account_info.not_set')}
            </div>
          </div>
        </div>
      </div>

      {editProfileOpen && user && (
        <EditProfileModal
          user={user}
          onClose={() => setEditProfileOpen(false)}
          onSave={() => {
            setEditProfileOpen(false);
            loadAccountData();
          }}
        />
      )}
    </>
  );
};

export default AccountInformation;
