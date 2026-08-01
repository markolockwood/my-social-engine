import React, { useState, useRef } from 'react';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import ImageUpload from './ImageUpload';
import '../styles/ComposeWidget.css';

const ComposeWidget = ({ parentPost = null, onSuccess, placeholder, submitLabel }) => {
  const [content, setContent]   = useState('');
  const [images, setImages]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resetKey, setResetKey] = useState(0);
  const imageInputRef           = useRef(null);
  const { user, t }             = useAuth();

  const handleSubmit = async () => {
    if ((!content.trim() && images.length === 0) || loading) return;
    setLoading(true);
    setError('');
    try {
      let imageUrls = [];
      if (images.length > 0) {
        const uploadRes = await postsAPI.uploadImages(images);
        imageUrls = uploadRes.data.urls;
      }
      const res = await postsAPI.create(
        content.trim(),
        imageUrls,
        parentPost ? parentPost.id : null,
        false
      );
      setContent('');
      setImages([]);
      setResetKey(k => k + 1);
      if (onSuccess) onSuccess(res.data.post);
    } catch (err) {
      setError(err.response?.data?.error || t('compose.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const remaining = 280 - content.length;
  const isOver    = remaining < 0;
  const canSubmit = (content.trim().length > 0 || images.length > 0) && !isOver && !loading;

  const defaultPlaceholder = parentPost
    ? t('post_page.comment_placeholder')
    : t('compose.placeholder');

  const defaultSubmitLabel = parentPost
    ? t('post_page.comment_submit')
    : t('compose.submit');

  return (
    <div className="compose-widget">
      <img
        src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.username}`}
        alt="Avatar"
        className="compose-widget-avatar"
      />
      <div className="compose-widget-body">
        <textarea
          className="compose-widget-textarea"
          placeholder={placeholder || defaultPlaceholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading}
          rows={2}
        />
        <ImageUpload
          onImagesChange={setImages}
          resetTrigger={resetKey}
          inputRef={imageInputRef}
          hideButton
        />
        {error && <div className="compose-widget-error">{error}</div>}
        <div className="compose-widget-footer">
          <div className="compose-widget-icons">
            <button
              type="button"
              className="compose-widget-icon-btn"
              onClick={() => imageInputRef.current?.click()}
              title="Добавить фото"
              disabled={loading}
            >
              🖼️
            </button>
            <button type="button" className="compose-widget-icon-btn" title="GIF" disabled>
              <span className="compose-widget-gif">GIF</span>
            </button>
            <button type="button" className="compose-widget-icon-btn" title="Emoji" disabled>
              😊
            </button>
          </div>
          <div className="compose-widget-actions">
            <span className={`compose-widget-count${isOver ? ' over' : ''}`}>{remaining}</span>
            <button
              className="compose-widget-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? '...' : (submitLabel || defaultSubmitLabel)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeWidget;
