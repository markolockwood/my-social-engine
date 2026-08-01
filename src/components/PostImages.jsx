import React, { useState } from 'react';
import ImageLightbox from './ImageLightbox';
import '../styles/PostImages.css';

/**
 * Компонент для отображения изображений в посте
 * Адаптивная сетка под количество изображений (1-4)
 */
const PostImages = ({ images, post }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!images || images.length === 0) return null;

  // Парсим JSON если это строка
  const imageList = typeof images === 'string' ? JSON.parse(images) : images;

  if (imageList.length === 0) return null;

  // Сортируем по order
  const sortedImages = [...imageList].sort((a, b) => a.order - b.order);

  const handleImageClick = (e, index) => {
    e.stopPropagation();
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className={`post-images post-images-${sortedImages.length}`}>
        {sortedImages.map((image, index) => (
          <div
            key={index}
            className="post-image-item"
            onClick={(e) => handleImageClick(e, index)}
          >
            <img
              src={image.url}
              alt={`Image ${index + 1}`}
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={sortedImages}
          initialIndex={lightboxIndex}
          post={post}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
};

export default PostImages;
