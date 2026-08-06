import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { postsAPI } from '../api/api';
import { CrossTabSync } from '../utils/crossTabSync';

const UploadContext = createContext();

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload должен использоваться внутри UploadProvider');
  }
  return context;
};

/**
 * Глобальный контекст для управления загрузками медиа.
 * Загрузки продолжаются в фоне даже при навигации между страницами.
 */
export const UploadProvider = ({ children }) => {
  // Хранилище всех активных и завершенных загрузок
  const [uploads, setUploads] = useState(new Map());
  const aborters = useRef(new Map());
  const syncRef = useRef(null);

  // Инициализируем синхронизацию между вкладками
  useEffect(() => {
    const sync = new CrossTabSync('temp_uploads_channel');
    syncRef.current = sync;

    return () => {
      sync.close();
      syncRef.current = null;
    };
  }, []);

  /**
   * Запускает загрузку файла
   */
  const startUpload = useCallback(async (id, file, type, contextKey = 'default') => {
    const ctrl = new AbortController();
    aborters.current.set(id, ctrl);

    const preview = URL.createObjectURL(file);

    // Создаём запись о загрузке
    setUploads(prev => {
      const newMap = new Map(prev);
      newMap.set(id, {
        id,
        file,
        type,
        preview,
        progress: 0,
        status: 'uploading',
        uploadedUrl: null,
        trackingId: id, // Используем ID как tracking ID для отмены
        filename: file.name,
        thumb: null,
        contextKey, // Для группировки загрузок (главная страница, комментарий и т.д.)
      });
      return newMap;
    });

    console.log(`[UPLOAD] START id=${id} type=${type} file=${file.name} context=${contextKey}`);

    try {
      let res;
      if (type === 'video') {
        res = await postsAPI.uploadVideo(file, {
          signal: ctrl.signal,
          headers: {
            'X-Tracking-ID': id,
            'X-Upload-Context': contextKey
          },
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 90) : 0;
            setUploads(prev => {
              const newMap = new Map(prev);
              const item = newMap.get(id);
              if (item) {
                newMap.set(id, { ...item, progress: pct });
              }
              return newMap;
            });
          },
        });
        console.log(`[UPLOAD] VIDEO SUCCESS id=${id} url=${res.data.url}`);
        // Сохраняем URL после завершения
        setUploads(prev => {
          const newMap = new Map(prev);
          const item = newMap.get(id);
          if (item) {
            newMap.set(id, {
              ...item,
              status: 'done',
              uploadedUrl: res.data.url,
              progress: 100
            });
          }
          return newMap;
        });
      } else if (type === 'gif') {
        res = await postsAPI.uploadGif(file, {
          signal: ctrl.signal,
          headers: {
            'X-Upload-Context': contextKey
          },
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            setUploads(prev => {
              const newMap = new Map(prev);
              const item = newMap.get(id);
              if (item) {
                newMap.set(id, { ...item, progress: pct });
              }
              return newMap;
            });
          },
        });
        console.log(`[UPLOAD] GIF SUCCESS id=${id} url=${res.data.url}`);
        setUploads(prev => {
          const newMap = new Map(prev);
          const item = newMap.get(id);
          if (item) {
            newMap.set(id, {
              ...item,
              status: 'done',
              uploadedUrl: res.data.url,
              preview: res.data.url, // Заменяем blob URL на серверный
              progress: 100,
            });
          }
          return newMap;
        });
      } else if (type === 'image') {
        res = await postsAPI.uploadImages([file], {
          signal: ctrl.signal,
          headers: {
            'X-Tracking-ID': id,
            'X-Upload-Context': contextKey
          },
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            setUploads(prev => {
              const newMap = new Map(prev);
              const item = newMap.get(id);
              if (item) {
                newMap.set(id, { ...item, progress: pct });
              }
              return newMap;
            });
          },
        });
        console.log(`[UPLOAD] IMAGE SUCCESS id=${id} response=`, res.data);
        const uploaded = res.data.urls[0];
        const url = typeof uploaded === 'string' ? uploaded : uploaded.url;
        const thumb = typeof uploaded === 'object' ? uploaded.thumb : null;
        setUploads(prev => {
          const newMap = new Map(prev);
          const item = newMap.get(id);
          if (item) {
            newMap.set(id, {
              ...item,
              status: 'done',
              uploadedUrl: url,
              tempUrl: url,
              thumb,
              progress: 100,
            });
          }
          return newMap;
        });
      }

      // Оповещаем другие вкладки о новой загрузке (только для главной страницы)
      if (contextKey === 'compose_main' && syncRef.current) {
        syncRef.current.send({
          action: 'temp_uploads_changed',
          reason: 'media_uploaded'
        });

        // BroadcastChannel не доставляет событие в ту же вкладку, где оно отправлено
        // Поэтому вызываем callback напрямую для локального обновления
        // (если он будет зарегистрирован в будущем)
        if (syncRef.current.localCallback) {
          syncRef.current.localCallback({
            action: 'temp_uploads_changed',
            reason: 'media_uploaded'
          });
        }
      }
    } catch (err) {
      console.error(`[UPLOAD] ERROR id=${id} type=${type}`, err);
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setUploads(prev => {
          const newMap = new Map(prev);
          const item = newMap.get(id);
          if (item) {
            newMap.set(id, { ...item, status: 'error' });
          }
          return newMap;
        });
      }
    } finally {
      aborters.current.delete(id);
    }
  }, []);

  /**
   * Отменяет загрузку и удаляет файл с сервера
   */
  const cancelUpload = useCallback((id) => {
    console.log(`[UPLOAD] CANCEL START id=${id}`);

    setUploads(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(id);
      if (item) {
        console.log(`[UPLOAD] CANCEL ITEM id=${id}`, {
          uploadedUrl: item.uploadedUrl,
          trackingId: item.trackingId,
          status: item.status,
          type: item.type
        });

        // Очищаем blob URL
        if (item.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }

        // Удаляем с сервера ПЕРЕД отменой запроса
        if (item.uploadedUrl) {
          // Если загрузка завершена, используем deleteMedia
          console.log(`[UPLOAD] CANCEL DELETE BY URL id=${id} url=${item.uploadedUrl}`);
          postsAPI.deleteMedia(item.uploadedUrl)
            .then(() => console.log(`[UPLOAD] CANCEL DELETE SUCCESS id=${id}`))
            .catch((err) => console.error(`[UPLOAD] CANCEL DELETE ERROR id=${id}`, err));
        } else if (item.trackingId) {
          // Если загрузка в процессе, используем cancelUpload по tracking ID
          console.log(`[UPLOAD] CANCEL DELETE BY TRACKING_ID id=${id} trackingId=${item.trackingId}`);
          postsAPI.cancelUpload(item.trackingId)
            .then(() => {
              console.log(`[UPLOAD] CANCEL DELETE SUCCESS id=${id}`);
              // Отменяем HTTP-запрос ПОСЛЕ успешного удаления файла
              const ctrl = aborters.current.get(id);
              if (ctrl) {
                ctrl.abort();
                aborters.current.delete(id);
              }
            })
            .catch((err) => {
              console.error(`[UPLOAD] CANCEL DELETE ERROR id=${id}`, err);
              // Отменяем запрос даже если удаление не удалось
              const ctrl = aborters.current.get(id);
              if (ctrl) {
                ctrl.abort();
                aborters.current.delete(id);
              }
            });
        } else {
          console.warn(`[UPLOAD] CANCEL NO URL OR TRACKING_ID id=${id}`);
        }
        newMap.delete(id);
      } else {
        console.warn(`[UPLOAD] CANCEL ITEM NOT FOUND id=${id}`);
      }
      return newMap;
    });
  }, []);

  /**
   * Удаляет завершенную загрузку из списка (без удаления с сервера)
   */
  const removeUpload = useCallback((id) => {
    setUploads(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(id);
      if (item?.preview?.startsWith('blob:')) {
        URL.revokeObjectURL(item.preview);
      }
      newMap.delete(id);
      return newMap;
    });
  }, []);

  /**
   * Очищает все завершенные загрузки для определенного контекста
   */
  const clearCompleted = useCallback((contextKey = 'default') => {
    setUploads(prev => {
      const newMap = new Map(prev);
      for (const [id, item] of newMap.entries()) {
        if (item.contextKey === contextKey && item.status === 'done') {
          if (item.preview?.startsWith('blob:')) {
            URL.revokeObjectURL(item.preview);
          }
          newMap.delete(id);
        }
      }
      return newMap;
    });
  }, []);

  /**
   * Получает все загрузки для определенного контекста
   */
  const getUploadsForContext = useCallback((contextKey = 'default') => {
    return Array.from(uploads.values()).filter(u => u.contextKey === contextKey);
  }, [uploads]);

  /**
   * Получает все активные загрузки (для глобального индикатора)
   */
  const getActiveUploads = useCallback(() => {
    return Array.from(uploads.values()).filter(u => u.status === 'uploading');
  }, [uploads]);

  const value = {
    uploads,
    startUpload,
    cancelUpload,
    removeUpload,
    clearCompleted,
    getUploadsForContext,
    getActiveUploads,
  };

  // Предупреждение при попытке закрыть/обновить страницу с активными загрузками
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const hasActiveUploads = Array.from(uploads.values()).some(
        upload => upload.status === 'uploading'
      );

      if (hasActiveUploads) {
        e.preventDefault();
        e.returnValue = ''; // Современные браузеры покажут свое стандартное сообщение
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploads]);

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
};
