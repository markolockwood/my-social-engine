import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '../api/api';
import en from '../i18n/en.json';
import ru from '../i18n/ru.json';

const translations = { en, ru };

// Получает значение по dot-notation ключу, например 'nav.home'
function resolve(dict, key) {
  return key.split('.').reduce((obj, k) => (obj ? obj[k] : undefined), dict) ?? key;
}

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,     setUser]     = useState(null);
  const [theme,    setTheme]    = useState('light');
  const [language, setLanguage] = useState('en');
  const [loading,  setLoading]  = useState(true);

  // Применяем тему к <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Применяем язык к <html> (полезно для lang-атрибута)
  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  // Восстанавливаем сессию при загрузке
  useEffect(() => {
    const token     = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setTheme(parsed.theme_preference || 'light');
      setLanguage(parsed.language || localStorage.getItem('language') || 'en');
    } else {
      // Без авторизации — берём язык из localStorage
      setLanguage(localStorage.getItem('language') || 'en');
    }
    setLoading(false);
  }, []);

  // Функция перевода: t('nav.home') → "Home"
  const t = useCallback((key) => resolve(translations[language] || translations.en, key), [language]);

  const login = async (username, password) => {
    const response = await authAPI.login({ username, password });
    const { token, user } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    setTheme(user.theme_preference || 'light');
    setLanguage(user.language || 'en');

    return user;
  };

  const register = async (username, email, password, displayName) => {
    const response = await authAPI.register({ username, email, password, displayName });
    const { token, user } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    setTheme(user.theme_preference || 'light');
    setLanguage(user.language || 'en');

    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setTheme('light');
    // язык оставляем — незалогиненный пользователь тоже может его менять
  };

  // Переключает тему и сохраняет в БД
  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    const updatedUser = user ? { ...user, theme_preference: newTheme } : null;
    if (updatedUser) {
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
    try {
      if (user) await authAPI.updateTheme(newTheme);
    } catch {
      setTheme(theme);
      if (updatedUser) { setUser(user); localStorage.setItem('user', JSON.stringify(user)); }
    }
  };

  // Меняет язык интерфейса и сохраняет в БД (если залогинен)
  const changeLanguage = async (lang) => {
    if (!translations[lang]) return;
    setLanguage(lang);
    localStorage.setItem('language', lang);
    const updatedUser = user ? { ...user, language: lang } : null;
    if (updatedUser) {
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
    try {
      if (user) await authAPI.updateLanguage(lang);
    } catch {
      setLanguage(language);
      if (updatedUser) { setUser(user); localStorage.setItem('user', JSON.stringify(user)); }
    }
  };

  const updateUser = (updatedFields) => {
    const merged = { ...user, ...updatedFields };
    setUser(merged);
    localStorage.setItem('user', JSON.stringify(merged));
  };

  return (
    <AuthContext.Provider value={{ user, theme, language, loading, t, login, register, logout, toggleTheme, changeLanguage, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
