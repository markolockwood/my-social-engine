import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUpload } from '../context/UploadContext';
import { postsAPI } from '../api/api';
import { CrossTabSync } from '../utils/crossTabSync';
import '../styles/MediaUpload.css';

/**
 * Все медиа (изображения, GIF, видео) загружаются на сервер НЕМЕДЛЕННО при прикреплении.
 * Для главной страницы: использует temp_uploads в БД для восстановления состояния.
 * Для комментариев: медиа НЕ сохраняются в temp_uploads, удаляются при unmount.
 */
const MediaUpload = ({ onMediaChange, resetTrigger, reloadTrigger, imageInputRef, gifInputRef, videoInputRef, initialItems, contextKey = 'default' }) => {
  const { startUpload, cancelUpload, removeUpload, getUploadsForContext } = useUpload();
  const [items, setItems] = useState(() => {
    // При монтировании восстанавливаем из initialItems (для комментариев)
    // Для главной страницы медиа загрузятся через fetchTempUploads
    const initial = initialItems || [];
    const activeUploads = getUploadsForContext(contextKey);

    // Добавляем активные загрузки, которых нет в initialItems
    const activeItems = activeUploads
      .filter(upload => !initial.some(item => item.id === upload.id))
      .map(upload => ({
        id: upload.id,
        file: null,
        type: upload.type,
        preview: upload.preview,
        status: upload.status,
        uploadedUrl: upload.uploadedUrl,
        filename: upload.filename,
        progress: upload.progress,
        thumb: upload.thumb,
      }));

    return [...initial, ...activeItems];
  });

  const [tempUploadsLoaded, setTempUploadsLoaded] = useState(false);
  const onMediaChangeRef = useRef(onMediaChange);
  const mountedRef       = useRef(false);
  const syncRef          = useRef(null);

  useEffect(() => { onMediaChangeRef.current = onMediaChange; }, [onMediaChange]);

  // Инициализируем синхронизацию между вкладками (ТОЛЬКО для главной страницы)
  useEffect(() => {
    if (contextKey !== 'compose_main') return;

    const sync = new CrossTabSync('temp_uploads_channel');
    syncRef.current = sync;

    return () => {
      sync.close();
      syncRef.current = null;
    };
  }, [contextKey]);

  // Загружаем медиа из temp_uploads API (ТОЛЬКО для главной страницы)
  useEffect(() => {
    if (contextKey !== 'compose_main' || tempUploadsLoaded) return;

    const fetchTempUploads = async () => {
      try {
        const res = await postsAPI.getTempUploads();
        if (res.data.media && res.data.media.length > 0) {
          console.log('[MediaUpload] Restoring from temp_uploads:', res.data.media);

          const restoredItems = res.data.media.map(m => ({
            id: `restored_${m.id}`,
            file: null,
            type: m.type,
            preview: m.file_path,
            status: 'done',
            uploadedUrl: m.file_path,
            filename: m.file_path.split('/').pop(),
            progress: 100,
            thumb: m.thumb || null,
            isRestored: true, // Помечаем как восстановленное из temp_uploads
          }));

          setItems(prev => {
            // Объединяем с существующими, избегая дубликатов
            const existingUrls = new Set(prev.map(item => item.uploadedUrl));
            const newItems = restoredItems.filter(item => !existingUrls.has(item.uploadedUrl));
            return [...prev, ...newItems];
          });
        }
        setTempUploadsLoaded(true);
      } catch (err) {
        console.error('[MediaUpload] Failed to fetch temp uploads:', err);
        setTempUploadsLoaded(true);
      }
    };

    fetchTempUploads();
  }, [contextKey, tempUploadsLoaded]);

  // Перезагрузка медиа при изменении reloadTrigger (синхронизация между вкладками)
  useEffect(() => {
    if (!reloadTrigger || contextKey !== 'compose_main') return;

    console.log('[MediaUpload] Reload triggered from another tab');

    const fetchTempUploads = async () => {
      try {
        const res = await postsAPI.getTempUploads();
        if (res.data.media) {
          console.log('[MediaUpload] Reloaded temp uploads:', res.data.media);

          const restoredItems = res.data.media.map(m => ({
            id: `restored_${m.id}_${Date.now()}`,
            file: null,
            type: m.type,
            preview: m.file_path,
            status: 'done',
            uploadedUrl: m.file_path,
            filename: m.file_path.split('/').pop(),
            progress: 100,
            thumb: m.thumb || null,
            isRestored: true, // Помечаем как восстановленное из temp_uploads
          }));

          // Полностью заменяем items на актуальные из API
          setItems(restoredItems);
        }
      } catch (err) {
        console.error('[MediaUpload] Failed to reload temp uploads:', err);
      }
    };

    fetchTempUploads();
  }, [reloadTrigger, contextKey]);

  // Синхронизируем локальные items с глобальным контекстом
  useEffect(() => {
    const uploadsForContext = getUploadsForContext(contextKey);

    setItems(prev => {
      let hasChanges = false;
      const newItems = [...prev];

      // 1. Обновляем существующие items (пропускаем восстановленные из temp_uploads)
      for (let i = 0; i < newItems.length; i++) {
        // Пропускаем медиа, восстановленные из temp_uploads
        if (newItems[i].isRestored) continue;

        const upload = uploadsForContext.find(u => u.id === newItems[i].id);
        if (upload && (
          upload.status !== newItems[i].status ||
          upload.progress !== newItems[i].progress ||
          upload.uploadedUrl !== newItems[i].uploadedUrl
        )) {
          hasChanges = true;
          newItems[i] = {
            ...newItems[i],
            status: upload.status,
            progress: upload.progress,
            uploadedUrl: upload.uploadedUrl,
            thumb: upload.thumb,
            preview: upload.preview,
          };
        }
      }

      // 2. Добавляем новые items из UploadContext (если их нет в текущем списке)
      uploadsForContext.forEach(upload => {
        if (!newItems.some(item => item.id === upload.id)) {
          hasChanges = true;
          newItems.push({
            id: upload.id,
            file: null,
            type: upload.type,
            preview: upload.preview,
            status: upload.status,
            uploadedUrl: upload.uploadedUrl,
            filename: upload.filename,
            progress: upload.progress,
            thumb: upload.thumb,
          });
        }
      });

      return hasChanges ? newItems : prev;
    });
  }, [getUploadsForContext, contextKey]);

  useEffect(() => {
    if (!onMediaChangeRef.current) return;
    onMediaChangeRef.current(
      items
        .filter(item => item.status !== 'error') // Не передаём файлы с ошибками
        .map(({ file, type, preview, uploadedUrl, status, filename, thumb }) => ({
          file,
          type,
          preview,
          uploadedUrl: uploadedUrl ?? null,
          uploading:   status === 'uploading',
          filename:    filename ?? file?.name ?? '',
          thumb:       thumb ?? null,
        }))
    );
  }, [items]);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    // Отменяем все загрузки для этого контекста
    setItems(prev => {
      prev.forEach(item => {
        if (item.status === 'uploading') {
          cancelUpload(item.id);
        }
      });
      return [];
    });
  }, [resetTrigger, cancelUpload]);

  const handleRemove = (id) => {
    const item = items.find(i => i.id === id);

    // Если загрузка завершена и есть uploadedUrl, удаляем напрямую через API
    if (item?.uploadedUrl) {
      postsAPI.deleteMedia(item.uploadedUrl)
        .then(() => {
          console.log(`[MediaUpload] Deleted from server: ${item.uploadedUrl}`);

          // Оповещаем другие вкладки об удалении (только для главной страницы)
          if (contextKey === 'compose_main' && syncRef.current) {
            syncRef.current.send({
              action: 'temp_uploads_changed',
              reason: 'media_deleted'
            });

            // Вызываем локальный callback для текущей вкладки
            if (syncRef.current.localCallback) {
              syncRef.current.localCallback({
                action: 'temp_uploads_changed',
                reason: 'media_deleted'
              });
            }
          }
        })
        .catch(err => {
          console.error('[MediaUpload] Failed to delete from server:', err);
          // Даже если удаление не удалось, оповещаем вкладки (возможно, уже удалено)
          if (contextKey === 'compose_main' && syncRef.current) {
            syncRef.current.send({
              action: 'temp_uploads_changed',
              reason: 'media_deleted'
            });

            if (syncRef.current.localCallback) {
              syncRef.current.localCallback({
                action: 'temp_uploads_changed',
                reason: 'media_deleted'
              });
            }
          }
        });
    }

    // Пытаемся отменить через контекст (на случай если загрузка ещё в процессе)
    cancelUpload(id);

    // Удаляем из глобального контекста загрузки
    removeUpload(id);

    // Удаляем из локального состояния
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleImageSelect = (e) => {
    const selected = Array.from(e.target.files).filter(f => f.size <= 5 * 1024 * 1024);
    e.target.value = '';
    if (selected.length === 0) return;

    setItems(prev => {
      const cap = 4 - prev.length;
      if (cap <= 0) return prev;

      const newItems = selected.slice(0, cap).map(file => {
        const id = `${Date.now()}_${Math.random()}`;
        const preview = URL.createObjectURL(file);

        // Запускаем загрузку через глобальный контекст
        startUpload(id, file, 'image', contextKey);

        return {
          id,
          file,
          type: 'image',
          preview,
          progress: 0,
          status: 'uploading',
          uploadedUrl: null,
          filename: file.name,
          thumb: null,
        };
      });

      return [...prev, ...newItems];
    });
  };

  const handleGifSelect = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('GIF превышает 10MB'); return; }

    setItems(prev => {
      if (prev.length >= 4) return prev;

      const id = `${Date.now()}_${Math.random()}`;
      const preview = URL.createObjectURL(file);

      // Запускаем загрузку через глобальный контекст
      startUpload(id, file, 'gif', contextKey);

      return [...prev, {
        id,
        file,
        type: 'gif',
        preview,
        progress: 0,
        status: 'uploading',
        uploadedUrl: null,
        filename: file.name,
      }];
    });
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setItems(prev => {
      if (prev.length >= 4) return prev;

      const id = `${Date.now()}_${Math.random()}`;
      const preview = URL.createObjectURL(file);

      // Запускаем загрузку через глобальный контекст
      startUpload(id, file, 'video', contextKey);

      return [...prev, {
        id,
        file,
        type: 'video',
        preview,
        progress: 0,
        status: 'uploading',
        uploadedUrl: null,
        filename: file.name,
      }];
    });
  };

  const uploadingItems = items.filter(it => it.status === 'uploading' || it.status === 'error');

  return (
    <div className="media-upload">
      {items.length > 0 && (
        <div className={`media-preview-grid media-preview-${items.filter(it => it.status !== 'error').length}`}>
          {items.filter(it => it.status !== 'error').map(item => {
            // GIF может быть сконвертирован в .mp4 — проверяем по URL
            const isGifAsMp4 = item.type === 'gif' && item.uploadedUrl?.endsWith('.mp4');
            return (
              <div key={item.id} className="media-preview-item">
                {item.type === 'video' || isGifAsMp4 ? (
                  <video src={item.preview} autoPlay loop muted playsInline />
                ) : (
                  <img src={item.preview} alt="Preview" />
                )}
                {item.type === 'gif' && <span className="media-type-badge">GIF</span>}
                {item.status === 'uploading' && (
                  <div className="media-upload-overlay">
                    <span className="media-upload-pct">{item.progress}%</span>
                  </div>
                )}
                <button type="button" className="media-remove-btn" onClick={() => handleRemove(item.id)} title="Удалить">×</button>
              </div>
            );
          })}
        </div>
      )}

      {uploadingItems.length > 0 && (
        <div className="video-progress-list">
          {uploadingItems.map(item => (
            <div key={item.id} className={`gif-upload-progress ${item.status === 'error' ? 'error' : ''}`}>
              <div className="gif-upload-progress-fill" style={{ width: `${item.progress ?? 0}%` }} />
              <span className="gif-upload-progress-text">
                {item.filename || item.file?.name}
                {item.status === 'uploading' && (
                  item.type === 'video' && item.progress >= 85
                    ? ': Конвертация...'
                    : `: Загрузка (${item.progress}%)`
                )}
                {item.status === 'done'  && ': Загружено'}
                {item.status === 'error' && ': Ошибка загрузки'}
              </span>
              {item.status === 'error' && (
                <button
                  type="button"
                  className="progress-close-btn"
                  onClick={() => handleRemove(item.id)}
                  title="Закрыть"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <input type="file" ref={imageInputRef} accept="image/jpeg,image/png,image/webp"
             multiple onChange={handleImageSelect} style={{ display: 'none' }} />
      <input type="file" ref={gifInputRef} accept="image/gif"
             onChange={handleGifSelect} style={{ display: 'none' }} />
      <input type="file" ref={videoInputRef} accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
             onChange={handleVideoSelect} style={{ display: 'none' }} />
    </div>
  );
};

export default MediaUpload;
