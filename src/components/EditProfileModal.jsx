import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { authAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import '../styles/EditProfileModal.css';

const EditProfileModal = ({ user, onClose, onSave }) => {
  const { t } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    display_name: user.display_name || '',
    bio:          user.bio          || '',
    location:     user.location     || '',
    birth_date:   user.birth_date   ? user.birth_date.slice(0, 10) : '',
  });
  const [avatarPreview, setAvatarPreview] = useState(
    user.avatar_url || `https://i.pravatar.cc/150?u=${user.username}`
  );
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.display_name.trim()) {
      setError(t('edit_profile.name_required'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      let avatarUrl = null;
      if (avatarFile) {
        const uploadRes = await authAPI.uploadAvatar(avatarFile);
        avatarUrl = uploadRes.data.url;
      }

      const payload = { ...form };
      if (avatarUrl) payload.avatar_url = avatarUrl;

      const res = await authAPI.updateProfile(payload);
      onSave(res.data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || t('edit_profile.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
          <span className="modal-title">{t('edit_profile.title')}</span>
          <button className="modal-save" onClick={handleSubmit} disabled={saving}>
            {saving ? t('edit_profile.saving') : t('edit_profile.save')}
          </button>
        </div>

        <div className="modal-banner" />

        <div className="modal-avatar-wrap">
          <div className="modal-avatar-overlay" onClick={handleAvatarClick} role="button" tabIndex={0} aria-label={t('edit_profile.change_avatar')}>
            <img src={avatarPreview} alt="Avatar" className="modal-avatar" />
            <div className="modal-avatar-dim">
              <span className="modal-avatar-icon">📷</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-fields">
          <label className="modal-field">
            <span className="modal-label">{t('edit_profile.name')}</span>
            <input
              className="modal-input"
              name="display_name"
              value={form.display_name}
              onChange={handleChange}
              maxLength={100}
            />
            <span className="modal-count">{form.display_name.length}/100</span>
          </label>

          <label className="modal-field">
            <span className="modal-label">{t('edit_profile.bio')}</span>
            <textarea
              className="modal-input modal-textarea"
              name="bio"
              value={form.bio}
              onChange={handleChange}
              maxLength={160}
              rows={3}
            />
            <span className="modal-count">{form.bio.length}/160</span>
          </label>

          <label className="modal-field">
            <span className="modal-label">{t('edit_profile.location')}</span>
            <input
              className="modal-input"
              name="location"
              value={form.location}
              onChange={handleChange}
              maxLength={100}
            />
          </label>

          <label className="modal-field">
            <span className="modal-label">{t('edit_profile.birth_date')}</span>
            <input
              className="modal-input"
              type="date"
              name="birth_date"
              value={form.birth_date}
              onChange={handleChange}
            />
          </label>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditProfileModal;
