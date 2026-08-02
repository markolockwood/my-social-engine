import React, { useState, useRef } from 'react';
import MediaLightbox from './MediaLightbox';
import '../styles/PostMedia.css';

const GifItem = ({ url, className, onImageClick }) => {
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef(null);
  const isVideo = url.endsWith('.mp4');

  const handleClick = (e) => {
    e.stopPropagation();

    if (isVideo && videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  return (
    <div className={`post-media-item gif-item ${className || ''}`}>
      {isVideo ? (
        <video
          ref={videoRef}
          src={url}
          loop
          muted
          autoPlay
          playsInline
          onClick={handleClick}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <img
          src={url}
          alt="GIF"
          loading="lazy"
          onClick={handleClick}
        />
      )}
      <span className="media-type-badge" onClick={handleClick}>GIF</span>
      {isVideo && !playing && (
        <div className="gif-play-overlay" onClick={handleClick}>
          <div className="gif-play-icon">▶</div>
        </div>
      )}
    </div>
  );
};

const PostMedia = ({ media, post }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!media) return null;

  const mediaList = typeof media === 'string' ? JSON.parse(media) : media;
  if (mediaList.length === 0) return null;

  const sorted = [...mediaList].sort((a, b) => a.order - b.order);

  const handleImageClick = (index) => (e) => {
    e.stopPropagation();
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className={`post-media post-media-${sorted.length}`}>
        {sorted.map((item, index) =>
          item.type === 'gif' ? (
            <GifItem key={index} url={item.url} onImageClick={handleImageClick(index)} />
          ) : (
            <div key={index} className="post-media-item" onClick={handleImageClick(index)}>
              <img src={item.thumb || item.url} alt={`Media ${index + 1}`} loading="lazy" />
            </div>
          )
        )}
      </div>

      {lightboxOpen && post && (
        <MediaLightbox
          media={sorted}
          initialIndex={lightboxIndex}
          post={post}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
};

export default PostMedia;
