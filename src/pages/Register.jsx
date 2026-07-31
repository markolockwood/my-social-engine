import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    displayName: ''
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const { register, t } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(formData.username, formData.email, formData.password, formData.displayName);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('auth.register_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-logo">M</div>
        <h1>{t('auth.register_title')}</h1>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              name="displayName"
              placeholder={t('auth.display_name')}
              value={formData.displayName}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              name="username"
              placeholder={t('auth.username')}
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder={t('auth.email')}
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder={t('auth.password_hint')}
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? t('auth.registering') : t('auth.register')}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {t('auth.have_account')} <Link to="/login">{t('auth.sign_in')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
