import React, { useState, useRef, useEffect, useMemo } from 'react';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import MediaUpload from './MediaUpload';
import { CrossTabSync, debounce } from '../utils/crossTabSync';
import '../styles/ComposeWidget.css';

function loadDraft(key) {
  if (!key) return { content: '' };
  try {
    const raw = localStorage.getItem(key);
    // Теперь сохраняем ТОЛЬКО текст поста, медиа восстанавливаем из API
    return raw ? JSON.parse(raw) : { content: '' };
  } catch { return { content: '' }; }
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
  const [tempUploadsLoaded, setTempUploadsLoaded] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0); // Триггер для перезагрузки MediaUpload
  const imageInputRef               = useRef(null);
  const gifInputRef                 = useRef(null);
  const videoInputRef               = useRef(null);
  const mediaFilesRef               = useRef([]);
  const syncRef                     = useRef(null);

  // Синхронизируем ref с state
  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);

  // Инициализируем синхронизацию между вкладками (ТОЛЬКО для главной страницы)
  useEffect(() => {
    if (parentPost) return; // Только для главной страницы

    // Создаём канал синхронизации
    const sync = new CrossTabSync('temp_uploads_channel');
    syncRef.current = sync;

    // Debounced функция перезагрузки медиа из API
    const debouncedReload = debounce(async () => {
      try {
        console.log('[ComposeWidget] Reloading temp uploads from other tab event');
        // Триггерим перезагрузку в MediaUpload
        setReloadTrigger(prev => prev + 1);
      } catch (err) {
        console.error('[ComposeWidget] Failed to reload temp uploads:', err);
      }
    }, 1000);

    // Слушаем события от других вкладок
    const unsubscribe = sync.listen((message) => {
      console.log('[ComposeWidget] Received cross-tab message:', message);

      if (message.action === 'temp_uploads_changed') {
        // Если пост был создан в другой вкладке — очищаем localStorage с черновиком
        if (message.reason === 'post_created' && draftKey) {
          console.log('[ComposeWidget] Post created in another tab, clearing draft');
          localStorage.removeItem(draftKey);
          setContent(''); // Очищаем поле ввода в неактивной вкладке
        }

        debouncedReload();
      }
    });

    return () => {
      unsubscribe();
      sync.close();
      syncRef.current = null;
    };
  }, [parentPost]);

  // Загружаем медиа из temp_uploads (ТОЛЬКО для главной страницы)
  useEffect(() => {
    if (parentPost || tempUploadsLoaded) return; // Только для главной страницы, один раз

    const fetchTempUploads = async () => {
      try {
        const res = await postsAPI.getTempUploads();
        if (res.data.media && res.data.media.length > 0) {
          console.log('[ComposeWidget] Loaded temp uploads from API:', res.data.media);
          setTempUploadsLoaded(true);
        }
      } catch (err) {
        console.error('[ComposeWidget] Failed to fetch temp uploads:', err);
        setTempUploadsLoaded(true); // Помечаем как загруженное чтобы не пытаться снова
      }
    };

    fetchTempUploads();
  }, [parentPost, tempUploadsLoaded]);

  // Восстанавливаем медиа из temp_uploads API (вместо localStorage)
  const initialMediaItems = useMemo(() => {
    // Для комментариев не восстанавливаем медиа
    if (parentPost) return [];

    // Для главной страницы медиа загрузятся через useEffect выше
    return [];
  }, []); // eslint-disable-line

  // Сохраняем ТОЛЬКО текст в localStorage (без медиа)
  useEffect(() => {
    if (!draftKey) return;

    if (content) {
      localStorage.setItem(draftKey, JSON.stringify({ content }));
    } else {
      localStorage.removeItem(draftKey);
    }

    // Очищаем завершенные загрузки из глобального контекста для главной страницы
    if (!parentPost && mediaFiles.some(f => f.uploadedUrl)) {
      const timer = setTimeout(() => {
        clearCompleted(contextKey);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [content, draftKey, parentPost, contextKey, clearCompleted, mediaFiles]);

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

      // Оповещаем другие вкладки об изменении temp_uploads (только для главной страницы)
      if (!parentPost && syncRef.current) {
        syncRef.current.send({
          action: 'temp_uploads_changed',
          reason: 'post_created'
        });

        // Вызываем локальный callback для текущей вкладки
        if (syncRef.current.localCallback) {
          syncRef.current.localCallback({
            action: 'temp_uploads_changed',
            reason: 'post_created'
          });
        }
      }

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
          reloadTrigger={reloadTrigger}
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
