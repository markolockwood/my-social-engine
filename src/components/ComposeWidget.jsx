import React, { useState, useRef, useEffect, useMemo } from 'react';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import MediaUpload from './MediaUpload';
import '../styles/ComposeWidget.css';

function loadDraft(key) {
  if (!key) return { content: '', uploadedMedia: [] };
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : { content: '', uploadedMedia: [] };
  } catch { return { content: '', uploadedMedia: [] }; }
}

const ComposeWidget = ({ parentPost = null, onSuccess, placeholder, submitLabel }) => {
  const { user, t } = useAuth();
  const { clearCompleted } = useUpload();
  const draftKey = !parentPost && user ? `compose_draft_${user.id}` : null;
  const contextKey = parentPost ? `comment_${parentPost.id}` : 'compose_main';
  const draft = useMemo(() => loadDraft(draftKey), []); // eslint-disable-line

  const [content, setContent]       = useState(draft.content || '');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [resetKey, setResetKey]     = useState(0);
  const imageInputRef               = useRef(null);
  const gifInputRef                 = useRef(null);
  const videoInputRef               = useRef(null);
  const mediaFilesRef               = useRef([]);

  // Синхронизируем ref с state
  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);

  // Восстанавливаем ВСЕ загруженные медиа из черновика (картинки, GIF, видео)
  const initialMediaItems = useMemo(() => {
    if (!draft.uploadedMedia?.length) return [];
    return draft.uploadedMedia.map(m => ({
      id:          `restored_${m.url}`,
      file:        null,
      type:        m.type,
      preview:     m.url,
      status:      'done',
      uploadedUrl: m.url,
      filename:    m.filename,
      progress:    100,
      thumb:       m.thumb ?? null,
    }));
  }, []); // eslint-disable-line

  // Сохраняем все загруженные медиа в черновик
  useEffect(() => {
    if (!draftKey) return;
    const uploadedMedia = mediaFiles
      .filter(f => f.uploadedUrl)
      .map(f => ({ type: f.type, url: f.uploadedUrl, filename: f.filename || '', thumb: f.thumb ?? null }));

    if (content || uploadedMedia.length > 0) {
      localStorage.setItem(draftKey, JSON.stringify({ content, uploadedMedia }));
    } else {
      localStorage.removeItem(draftKey);
    }

    // Очищаем завершенные загрузки из глобального контекста для главной страницы
    // Они уже сохранены в localStorage и будут восстановлены из initialItems
    if (!parentPost && uploadedMedia.length > 0) {
      // Используем небольшую задержку, чтобы не очищать сразу
      const timer = setTimeout(() => {
        clearCompleted(contextKey);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [content, mediaFiles, draftKey, parentPost, contextKey, clearCompleted]);

  // Cleanup: удаляем загруженные медиа при размонтировании (только для комментариев)
  useEffect(() => {
    if (!parentPost) return; // Только для комментариев, не для главной страницы

    return () => {
      // При размонтировании удаляем все загруженные медиа
      mediaFilesRef.current.forEach(f => {
        if (f.uploadedUrl) {
          postsAPI.deleteMedia(f.uploadedUrl).catch(() => {});
        }
      });
    };
  }, [parentPost]);

  const handleSubmit = async () => {
    if ((!content.trim() && mediaFiles.length === 0) || loading) return;

    console.log('[DEBUG] mediaFiles before submit:', mediaFiles);

    setLoading(true);
    setError('');
    try {
      // Все медиа уже загружены — используем uploadedUrl напрямую
      const uploadedMedia = mediaFiles
        .filter(f => f.uploadedUrl)
        .map(f => ({
          url:   f.uploadedUrl,
          type:  f.type,
          thumb: f.thumb ?? null,
        }));

      console.log('[DEBUG] uploadedMedia to send:', uploadedMedia);

      const res = await postsAPI.create(
        content.trim(),
        uploadedMedia,
        parentPost ? parentPost.id : null,
        false
      );

      setContent('');
      setMediaFiles([]);
      setResetKey(k => k + 1);
      if (draftKey) localStorage.removeItem(draftKey);
      if (onSuccess) onSuccess(res.data.post);
    } catch (err) {
      setError(err.response?.data?.error || t('compose.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const remaining        = 280 - content.length;
  const isOver           = remaining < 0;
  const isFull           = mediaFiles.length >= 4;
  const anyMediaUploading = mediaFiles.some(f => f.uploading);
  const canSubmit        = (content.trim().length > 0 || mediaFiles.length > 0)
                           && !isOver && !loading && !anyMediaUploading;

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
          videoInputRef={videoInputRef}
          initialItems={initialMediaItems}
          contextKey={contextKey}
        />
        {error && <div className="compose-widget-error">{error}</div>}
        <div className="compose-widget-footer">
          <div className="compose-widget-icons">
            <button
              type="button"
              className="compose-widget-icon-btn"
              onClick={() => imageInputRef.current?.click()}
              title="Добавить фото"
              disabled={loading || isFull}
            >
              🖼️
            </button>
            <button
              type="button"
              className="compose-widget-icon-btn"
              onClick={() => gifInputRef.current?.click()}
              title="Добавить GIF"
              disabled={loading || isFull}
            >
              <span className="compose-widget-gif">GIF</span>
            </button>
            <button
              type="button"
              className="compose-widget-icon-btn"
              onClick={() => videoInputRef.current?.click()}
              title="Добавить видео"
              disabled={loading || isFull}
            >
              <span className="compose-widget-gif">VID</span>
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
