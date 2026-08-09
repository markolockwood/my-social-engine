import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/api';
import '../styles/ChangeUsername.css';

// Список стран (основные)
const COUNTRIES = [
  { code: 'US', name: 'United States', nameRu: 'США' },
  { code: 'GB', name: 'United Kingdom', nameRu: 'Великобритания' },
  { code: 'CA', name: 'Canada', nameRu: 'Канада' },
  { code: 'AU', name: 'Australia', nameRu: 'Австралия' },
  { code: 'DE', name: 'Germany', nameRu: 'Германия' },
  { code: 'FR', name: 'France', nameRu: 'Франция' },
  { code: 'IT', name: 'Italy', nameRu: 'Италия' },
  { code: 'ES', name: 'Spain', nameRu: 'Испания' },
  { code: 'NL', name: 'Netherlands', nameRu: 'Нидерланды' },
  { code: 'SE', name: 'Sweden', nameRu: 'Швеция' },
  { code: 'NO', name: 'Norway', nameRu: 'Норвегия' },
  { code: 'DK', name: 'Denmark', nameRu: 'Дания' },
  { code: 'FI', name: 'Finland', nameRu: 'Финляндия' },
  { code: 'PL', name: 'Poland', nameRu: 'Польша' },
  { code: 'RU', name: 'Russia', nameRu: 'Россия' },
  { code: 'UA', name: 'Ukraine', nameRu: 'Украина' },
  { code: 'BY', name: 'Belarus', nameRu: 'Беларусь' },
  { code: 'KZ', name: 'Kazakhstan', nameRu: 'Казахстан' },
  { code: 'JP', name: 'Japan', nameRu: 'Япония' },
  { code: 'CN', name: 'China', nameRu: 'Китай' },
  { code: 'KR', name: 'South Korea', nameRu: 'Южная Корея' },
  { code: 'IN', name: 'India', nameRu: 'Индия' },
  { code: 'BR', name: 'Brazil', nameRu: 'Бразилия' },
  { code: 'MX', name: 'Mexico', nameRu: 'Мексика' },
  { code: 'AR', name: 'Argentina', nameRu: 'Аргентина' },
];

const ChangeCountry = () => {
  const { user, language, t } = useAuth();
  const navigate = useNavigate();
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountData, setAccountData] = useState(null);

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    try {
      const res = await authAPI.getAccountInfo();
      setAccountData(res.data);
      setCountry(res.data.country || '');
    } catch (err) {
      console.error('Failed to load account info', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!country) {
      setError(t('settings.country.error_required'));
      return;
    }

    setLoading(true);
    try {
      await authAPI.updateCountry(country);
      navigate('/settings/account/info');
    } catch (err) {
      setError(err.response?.data?.error || t('settings.country.error_save'));
    } finally {
      setLoading(false);
    }
  };

  const getCountryName = (code) => {
    const c = COUNTRIES.find(item => item.code === code);
    return c ? (language === 'ru' ? c.nameRu : c.name) : code;
  };

  return (
    <>
      <div className="main-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{t('settings.country.title')}</h2>
      </div>

      <div className="change-form-container">
        <p className="change-form-desc">{t('settings.country.description')}</p>

        <form onSubmit={handleSubmit} className="change-form">
          <div className="change-form-field">
            <label className="change-form-label">{t('settings.country.label')}</label>
            <select
              className="change-form-select"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={loading}
            >
              <option value="">{t('settings.country.select')}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {language === 'ru' ? c.nameRu : c.name}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="change-form-error">{error}</div>}

          <button type="submit" className="change-form-btn" disabled={loading || !country}>
            {loading ? t('settings.country.saving') : t('settings.country.save')}
          </button>
        </form>
      </div>
    </>
  );
};

export default ChangeCountry;
