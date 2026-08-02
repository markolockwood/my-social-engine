import React, { useState, useEffect } from 'react';
import '../styles/MediaUpload.css';

const MediaUpload = ({ onMediaChange, resetTrigger, imageInputRef, gifInputRef }) => {
  const [previewUrls, setPreviewUrls] = useState([]);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (resetTrigger !== undefined) {
      setPreviewUrls([]);
      setFiles([]);
    }
  }, [resetTrigger]);

  const addFiles = (selectedFiles, type) => {
    const remainingSlots = 4 - files.length;
    const filesToAdd = selectedFiles.slice(0, remainingSlots);
    if (filesToAdd.length === 0) return;

    const maxSize = type === 'gif' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    const validFiles = filesToAdd.filter(file => file.size <= maxSize);

    if (validFiles.length !== filesToAdd.length) {
      alert(`Некоторые файлы превышают ${type === 'gif' ? '10' : '5'}MB`);
    }

    if (validFiles.length === 0) return;

    const newPreviewUrls = [];
    const newFiles = [];

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviewUrls.push(e.target.result);
        newFiles.push({ file, type, preview: e.target.result });

        if (newPreviewUrls.length === validFiles.length) {
          const updatedFiles = [...files, ...newFiles];
          const updatedPreviews = [...previewUrls, ...newPreviewUrls];
          setFiles(updatedFiles);
          setPreviewUrls(updatedPreviews);
          if (onMediaChange) onMediaChange(updatedFiles);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = (e) => {
    addFiles(Array.from(e.target.files), 'image');
    e.target.value = '';
  };

  const handleGifSelect = (e) => {
    const selected = Array.from(e.target.files);
    addFiles(selected, 'gif');
    e.target.value = '';
  };

  const handleRemove = (index) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    const updatedPreviews = previewUrls.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    setPreviewUrls(updatedPreviews);
    if (onMediaChange) onMediaChange(updatedFiles);
  };

  const hasGif = files.some(f => f.type === 'gif');

  return (
    <div className="media-upload">
      {previewUrls.length > 0 && (
        <div className={`media-preview-grid media-preview-${previewUrls.length}`}>
          {previewUrls.map((url, index) => (
            <div key={index} className="media-preview-item">
              <img src={url} alt={`Preview ${index + 1}`} />
              {files[index].type === 'gif' && (
                <span className="media-type-badge">GIF</span>
              )}
              <button
                type="button"
                className="media-remove-btn"
                onClick={() => handleRemove(index)}
                title="Удалить"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        type="file"
        ref={imageInputRef}
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleImageSelect}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={gifInputRef}
        accept="image/gif"
        onChange={handleGifSelect}
        style={{ display: 'none' }}
        disabled={hasGif}
      />
    </div>
  );
};

export default MediaUpload;
