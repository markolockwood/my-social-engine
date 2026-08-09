import React from 'react';
import { useUpload } from '@/context/UploadContext';
import './GlobalUploadIndicator.css';

/**
 * Глобальный индикатор загрузок, показывается в углу экрана
 * и отображает все активные загрузки независимо от текущей страницы
 */
const GlobalUploadIndicator = () => {
  const { getActiveUploads } = useUpload();
  const activeUploads = getActiveUploads();

  if (activeUploads.length === 0) {
    return null;
  }

  return (
    <div className="global-upload-indicator">
      <div className="global-upload-header">
        <span>Загрузка медиа ({activeUploads.length})</span>
      </div>
      <div className="global-upload-list">
        {activeUploads.map(upload => (
          <div key={upload.id} className="global-upload-item">
            <span className="global-upload-filename">
              {upload.filename}
            </span>
            <div className="global-upload-progress">
              <div
                className="global-upload-progress-fill"
                style={{ width: `${upload.progress}%` }}
              />
            </div>
            <span className="global-upload-status">
              {upload.type === 'video' && upload.progress >= 85
                ? 'Конвертация...'
                : `${upload.progress}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GlobalUploadIndicator;
