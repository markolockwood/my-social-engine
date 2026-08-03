import React, { useState, useEffect, useRef, useCallback } from 'react';
import { postsAPI } from '../api/api';
import '../styles/MediaUpload.css';

/**
 * Все медиа (изображения, GIF, видео) загружаются на сервер НЕМЕДЛЕННО при прикреплении.
 * Это позволяет сохранять их в черновике по server URL.
 */
const MediaUpload = ({ onMediaChange, resetTrigger, imageInputRef, gifInputRef, videoInputRef, initialItems }) => {
  const [items, setItems] = useState(() => initialItems || []);

  const aborters         = useRef(new Map());
  const onMediaChangeRef = useRef(onMediaChange);
  const mountedRef       = useRef(false);
  useEffect(() => { onMediaChangeRef.current = onMediaChange; }, [onMediaChange]);

  useEffect(() => {
    if (!onMediaChangeRef.current) return;
    onMediaChangeRef.current(
      items.map(({ file, type, preview, uploadedUrl, status, filename, thumb }) => ({
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
    aborters.current.forEach(c => c.abort());
    aborters.current.clear();
    setItems(prev => {
      prev.forEach(item => {
        if (item.preview?.startsWith('blob:')) URL.revokeObjectURL(item.preview);
      });
      return [];
    });
  }, [resetTrigger]);

  const startUpload = useCallback(async (id, file, type) => {
    const ctrl = new AbortController();
    aborters.current.set(id, ctrl);
    console.log(`[UPLOAD] START id=${id} type=${type} file=${file.name}`);
    try {
      let res;
      if (type === 'video') {
        res = await postsAPI.uploadVideo(file, {
          signal: ctrl.signal,
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 90) : 0;
            setItems(prev => prev.map(it => it.id === id ? { ...it, progress: pct } : it));
          },
        });
        console.log(`[UPLOAD] VIDEO SUCCESS id=${id} url=${res.data.url}`);
        setItems(prev =>
          prev.map(it => it.id === id
            ? { ...it, status: 'done', uploadedUrl: res.data.url, progress: 100 }
            : it
          )
        );
      } else if (type === 'gif') {
        res = await postsAPI.uploadGif(file, {
          signal: ctrl.signal,
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            setItems(prev => prev.map(it => it.id === id ? { ...it, progress: pct } : it));
          },
        });
        console.log(`[UPLOAD] GIF SUCCESS id=${id} url=${res.data.url}`);
        setItems(prev =>
          prev.map(it => {
            if (it.id === id) {
              if (it.preview?.startsWith('blob:')) URL.revokeObjectURL(it.preview);
              return { ...it, status: 'done', uploadedUrl: res.data.url, preview: res.data.url, progress: 100 };
            }
            return it;
          })
        );
      } else if (type === 'image') {
        res = await postsAPI.uploadImages([file], {
          signal: ctrl.signal,
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            setItems(prev => prev.map(it => it.id === id ? { ...it, progress: pct } : it));
          },
        });
        console.log(`[UPLOAD] IMAGE SUCCESS id=${id} response=`, res.data);
        const uploaded = res.data.urls[0];
        const url   = typeof uploaded === 'string' ? uploaded : uploaded.url;
        const thumb = typeof uploaded === 'object' ? uploaded.thumb : null;
        console.log(`[UPLOAD] IMAGE PARSED url=${url} thumb=${thumb}`);
        setItems(prev =>
          prev.map(it => it.id === id
            ? { ...it, status: 'done', uploadedUrl: url, thumb, progress: 100 }
            : it
          )
        );
      }
    } catch (err) {
      console.error(`[UPLOAD] ERROR id=${id} type=${type}`, err);
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setItems(prev => prev.map(it => it.id === id ? { ...it, status: 'error' } : it));
      }
    } finally {
      aborters.current.delete(id);
    }
  }, []);

  const handleRemove = (id) => {
    const ctrl = aborters.current.get(id);
    if (ctrl) { ctrl.abort(); aborters.current.delete(id); }
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.preview?.startsWith('blob:')) URL.revokeObjectURL(item.preview);
      if (item?.uploadedUrl) {
        postsAPI.deleteMedia(item.uploadedUrl).catch(() => {});
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const handleImageSelect = (e) => {
    const selected = Array.from(e.target.files).filter(f => f.size <= 5 * 1024 * 1024);
    e.target.value = '';
    if (selected.length === 0) return;

    // Создаём items и blob URL ВНЕ setItems — side effects нельзя в updater
    const newItems = selected.map(file => ({
      id:          `${Date.now()}_${Math.random()}`,
      file,
      type:        'image',
      preview:     URL.createObjectURL(file),
      progress:    0,
      status:      'uploading',
      uploadedUrl: null,
      filename:    file.name,
      thumb:       null,
    }));

    setItems(prev => {
      const cap = 4 - prev.length;
      return cap > 0 ? [...prev, ...newItems.slice(0, cap)] : prev;
    });

    newItems.forEach(item => startUpload(item.id, item.file, 'image'));
  };

  const handleGifSelect = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('GIF превышает 10MB'); return; }

    const id      = `${Date.now()}_${Math.random()}`;
    const preview = URL.createObjectURL(file);
    setItems(prev => {
      if (prev.length >= 4) return prev;
      return [...prev, { id, file, type: 'gif', preview, progress: 0, status: 'uploading', uploadedUrl: null, filename: file.name }];
    });
    startUpload(id, file, 'gif');
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const id      = `${Date.now()}_${Math.random()}`;
    const preview = URL.createObjectURL(file);
    setItems(prev => {
      if (prev.length >= 4) return prev;
      return [...prev, { id, file, type: 'video', preview, progress: 0, status: 'uploading', uploadedUrl: null, filename: file.name }];
    });
    startUpload(id, file, 'video');
  };

  const uploadingItems = items.filter(it => it.status === 'uploading' || it.status === 'error');

  return (
    <div className="media-upload">
      {items.length > 0 && (
        <div className={`media-preview-grid media-preview-${items.length}`}>
          {items.map(item => {
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
            <div key={item.id} className="gif-upload-progress">
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
