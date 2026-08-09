import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/api/api';
import './ChangeForm.css';

const ChangeGender = () => {
  const { t } = useAuth();
  const navigate = useNavigate();
  const [genderType, setGenderType] = useState(''); // 'male', 'female', 'custom'
  const [customGender, setCustomGender] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    try {
      const res = await authAPI.getAccountInfo();
      const gender = res.data.gender;

      if (!gender) {
        setGenderType('');
      } else if (gender === 'male' || gender === 'female') {
        setGenderType(gender);
      } else {
        setGenderType('custom');
        setCustomGender(gender);
      }
    } catch (err) {
      console.error('Failed to load account info', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!genderType) {
      setError(t('settings.gender.error_required'));
      return;
    }

    if (genderType === 'custom' && !customGender.trim()) {
      setError(t('settings.gender.error_custom_empty'));
      return;
    }

    if (genderType === 'custom' && customGender.length > 16) {
      setError(t('settings.gender.error_custom_length'));
      return;
    }

    const genderValue = genderType === 'custom' ? customGender.trim() : genderType;

    setLoading(true);
    try {
      await authAPI.updateGender(genderValue);
      navigate('/settings/account/info');
    } catch (err) {
      setError(err.response?.data?.error || t('settings.gender.error_save'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="main-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{t('settings.gender.title')}</h2>
      </div>

      <div className="change-form-container">
        <p className="change-form-desc">{t('settings.gender.description')}</p>

        <form onSubmit={handleSubmit} className="change-form">
          <div className="change-form-radio-group">
            <label className={`change-form-radio-item${genderType === 'male' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="gender"
                value="male"
                checked={genderType === 'male'}
                onChange={(e) => {
                  setGenderType(e.target.value);
                  setCustomGender('');
                }}
                disabled={loading}
              />
              <span className="change-form-radio-label">{t('settings.gender.male')}</span>
            </label>

            <label className={`change-form-radio-item${genderType === 'female' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="gender"
                value="female"
                checked={genderType === 'female'}
                onChange={(e) => {
                  setGenderType(e.target.value);
                  setCustomGender('');
                }}
                disabled={loading}
              />
              <span className="change-form-radio-label">{t('settings.gender.female')}</span>
            </label>

            <label className={`change-form-radio-item${genderType === 'custom' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="gender"
                value="custom"
                checked={genderType === 'custom'}
                onChange={(e) => setGenderType(e.target.value)}
                disabled={loading}
              />
              <span className="change-form-radio-label">{t('settings.gender.custom')}</span>
            </label>
          </div>

          {genderType === 'custom' && (
            <div className="change-form-field">
              <input
                type="text"
                className="change-form-input"
                value={customGender}
                onChange={(e) => setCustomGender(e.target.value)}
                placeholder={t('settings.gender.custom_placeholder')}
                maxLength={16}
                disabled={loading}
              />
              <div className="change-form-hint">
                {customGender.length}/16 {t('settings.gender.characters')}
              </div>
            </div>
          )}

          {error && <div className="change-form-error">{error}</div>}

          <button type="submit" className="change-form-btn" disabled={loading || !genderType || (genderType === 'custom' && !customGender.trim())}>
            {loading ? t('settings.gender.saving') : t('settings.gender.save')}
          </button>
        </form>
      </div>
    </>
  );
};

export default ChangeGender;
