import React, { useState, useEffect } from 'react';
import '../styles/ImageUpload.css';

/**
 * Компонент для загрузки изображений к посту
 * Позволяет выбрать до 4 изображений с превью
 */
const ImageUpload = ({ onImagesChange, resetTrigger, inputRef, hideButton = false }) => {
  const [previewUrls, setPreviewUrls] = useState([]);
  const [files, setFiles] = useState([]);

  // Сброс при изменении resetTrigger
  useEffect(() => {
    if (resetTrigger !== undefined) {
      setPreviewUrls([]);
      setFiles([]);
    }
  }, [resetTrigger]);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);

    // Ограничение на 4 изображения
    const remainingSlots = 4 - files.length;
    const filesToAdd = selectedFiles.slice(0, remainingSlots);

    if (filesToAdd.length === 0) return;

    // Валидация типов файлов
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const validFiles = filesToAdd.filter(file => validTypes.includes(file.type));

    if (validFiles.length !== filesToAdd.length) {
      alert('Некоторые файлы не являются изображениями и были пропущены');
    }

    // Валидация размера (5MB)
    const maxSize = 5 * 1024 * 1024;
    const smallEnoughFiles = validFiles.filter(file => file.size <= maxSize);

    if (smallEnoughFiles.length !== validFiles.length) {
      alert('Некоторые файлы превышают 5MB и были пропущены');
    }

    if (smallEnoughFiles.length === 0) return;

    // Создание превью
    const newPreviewUrls = [];
    smallEnoughFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviewUrls.push(e.target.result);
        if (newPreviewUrls.length === smallEnoughFiles.length) {
          const updatedFiles = [...files, ...smallEnoughFiles];
          const updatedPreviews = [...previewUrls, ...newPreviewUrls];
          setFiles(updatedFiles);
          setPreviewUrls(updatedPreviews);
          if (onImagesChange) onImagesChange(updatedFiles);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemove = (index) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    const updatedPreviews = previewUrls.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    setPreviewUrls(updatedPreviews);
    if (onImagesChange) onImagesChange(updatedFiles);
  };

  return (
    <div className="image-upload">
      {previewUrls.length > 0 && (
        <div className={`image-preview-grid image-preview-${previewUrls.length}`}>
          {previewUrls.map((url, index) => (
            <div key={index} className="image-preview-item">
              <img src={url} alt={`Preview ${index + 1}`} />
              <button
                type="button"
                className="image-remove-btn"
                onClick={() => handleRemove(index)}
                title="Удалить"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length < 4 && (
        <>
          <input
            type="file"
            ref={inputRef}
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {!hideButton && (
            <label className="image-upload-btn" onClick={() => inputRef?.current?.click()}>
              <span className="image-upload-icon">🖼️</span>
              <span className="image-upload-text">
                {files.length === 0 ? 'Добавить изображения' : `Добавить ещё (${files.length}/4)`}
              </span>
            </label>
          )}
        </>
      )}
    </div>
  );
};

export default ImageUpload;
