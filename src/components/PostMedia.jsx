import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from './VideoPlayer';
import MediaLightbox from './MediaLightbox';
import '../styles/PostMedia.css';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const GifItem = ({ url }) => {
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef(null);
  const isVideo  = url.endsWith('.mp4');

  const handleClick = (e) => {
    e.stopPropagation();
    if (isVideo && videoRef.current) {
      if (playing) videoRef.current.pause();
      else videoRef.current.play();
      setPlaying(!playing);
    }
  };

  return (
    <div className="post-media-item gif-item" onClick={handleClick}>
      {isVideo ? (
        <video
          ref={videoRef}
          src={url}
          loop muted autoPlay playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <img src={url} alt="GIF" loading="lazy" />
      )}
      <span className="media-type-badge">GIF</span>
      {isVideo && !playing && (
        <div className="gif-play-overlay">
          <div className="gif-play-icon">▶</div>
        </div>
      )}
    </div>
  );
};

// Глобальный CustomEvent — только одно видео играет одновременно
const VIDEO_PLAY_EVENT = 'mytwit:video-play';

const VideoItem = ({ url, onOpenLightbox }) => {
  const { user } = useAuth();
  const [playing, setPlaying]   = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const playerRef = useRef(null);
  const idRef     = useRef(`vid_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail.id !== idRef.current) {
        playerRef.current?.pause();
        setPlaying(false);
      }
    };
    window.addEventListener(VIDEO_PLAY_EVENT, handler);
    return () => window.removeEventListener(VIDEO_PLAY_EVENT, handler);
  }, []);

  const handleTimeUpdate = () => {
    const video = playerRef.current?.video;
    if (video) {
      const left = video.duration - video.currentTime;
      setTimeLeft(isFinite(left) ? left : null);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    setTimeLeft(null);
    const video = playerRef.current?.video;
    if (video) video.currentTime = 0;
  };

  const handleLoadedMetadata = () => {
    const video = playerRef.current?.video;
    if (video) setTimeLeft(isFinite(video.duration) ? video.duration : null);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!playing) {
      // Первый клик: запуск со звуком
      const p = playerRef.current;
      if (p && p.video) {
        const savedVolume = user?.video_volume ?? 0.45;
        p.video.volume = savedVolume;
        p.muted = false;
        p.play();
        setPlaying(true);
        window.dispatchEvent(new CustomEvent(VIDEO_PLAY_EVENT, { detail: { id: idRef.current } }));
      }
    } else {
      // Второй клик во время воспроизведения: остановить и открыть лайтбокс
      playerRef.current?.pause();
      setPlaying(false);
      onOpenLightbox();
    }
  };

  return (
    <div className="post-media-item post-media-video-item" onClick={handleClick}>
      <VideoPlayer
        ref={playerRef}
        src={url}
        muted
        objectFit="cover"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <div className="video-controls-bar">
        <span className="video-play-icon">{playing ? '⏸' : '▶'}</span>
        {playing && timeLeft !== null && (
          <span className="video-timer">{formatTime(timeLeft)}</span>
        )}
      </div>
    </div>
  );
};

const PostMedia = ({ media, post }) => {
  const [lightboxOpen, setLightboxOpen]   = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!media) return null;
  const mediaList = typeof media === 'string' ? JSON.parse(media) : media;
  if (mediaList.length === 0) return null;
  const sorted = [...mediaList].sort((a, b) => a.order - b.order);

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className={`post-media post-media-${sorted.length}`}>
        {sorted.map((item, index) =>
          item.type === 'video' ? (
            <VideoItem
              key={index}
              url={item.url}
              onOpenLightbox={() => openLightbox(index)}
            />
          ) : item.type === 'gif' ? (
            <GifItem key={index} url={item.url} />
          ) : (
            <div
              key={index}
              className="post-media-item"
              onClick={(e) => { e.stopPropagation(); openLightbox(index); }}
            >
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
