import React, { useState, useRef } from 'react';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import MediaUpload from './MediaUpload';
import '../styles/ComposeWidget.css';

const ComposeWidget = ({ parentPost = null, onSuccess, placeholder, submitLabel }) => {
  const [content, setContent]   = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resetKey, setResetKey] = useState(0);
  const imageInputRef           = useRef(null);
  const gifInputRef             = useRef(null);
  const { user, t }             = useAuth();

  const handleSubmit = async () => {
    if ((!content.trim() && mediaFiles.length === 0) || loading) return;
    setLoading(true);
    setError('');
    try {
      let uploadedMedia = [];

      for (const item of mediaFiles) {
        let uploadRes;
        if (item.type === 'gif') {
          uploadRes = await postsAPI.uploadGif(item.file);
          uploadedMedia.push({ url: uploadRes.data.url, type: 'gif' });
        } else {
          uploadRes = await postsAPI.uploadImages([item.file]);
          const uploaded = uploadRes.data.urls[0];
          uploadedMedia.push({
            url: typeof uploaded === 'string' ? uploaded : uploaded.url,
            thumb: typeof uploaded === 'object' ? uploaded.thumb : null,
            type: 'image'
          });
        }
      }

      const res = await postsAPI.create(
        content.trim(),
        uploadedMedia,
        parentPost ? parentPost.id : null,
        false
      );
      setContent('');
      setMediaFiles([]);
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
  const canSubmit = (content.trim().length > 0 || mediaFiles.length > 0) && !isOver && !loading;
  const hasGif    = mediaFiles.some(f => f.type === 'gif');

  const defaultPlaceholder = parentPost ? t('post_page.comment_placeholder') : t('compose.placeholder');
  const defaultSubmitLabel = parentPost ? t('post_page.comment_submit') : t('compose.submit');

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
        <MediaUpload
          onMediaChange={setMediaFiles}
          resetTrigger={resetKey}
          imageInputRef={imageInputRef}
          gifInputRef={gifInputRef}
        />
        {error && <div className="compose-widget-error">{error}</div>}
        <div className="compose-widget-footer">
          <div className="compose-widget-icons">
            <button
              type="button"
              className="compose-widget-icon-btn"
              onClick={() => imageInputRef.current?.click()}
              title="Добавить фото"
              disabled={loading || mediaFiles.length >= 4}
            >
              🖼️
            </button>
            <button
              type="button"
              className="compose-widget-icon-btn"
              onClick={() => gifInputRef.current?.click()}
              title="Добавить GIF"
              disabled={loading || mediaFiles.length >= 4 || hasGif}
            >
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
