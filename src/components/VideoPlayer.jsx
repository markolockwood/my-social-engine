import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';
import { useAuth } from '../context/AuthContext';
import '../styles/VideoPlayer.css';

const VideoPlayer = forwardRef(({
  src,
  muted = true,
  autoPlay = false,
  showQuality = false,
  objectFit = 'cover',
  onTimeUpdate,
  onEnded,
  onLoadedMetadata,
}, ref) => {
  const { user, updateVideoVolume, t } = useAuth();
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const [levels, setLevels]           = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playing, setPlaying]         = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [volume, setVolume]           = useState(muted ? 0 : (user?.video_volume ?? 0.45));
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [draggingVolume, setDraggingVolume] = useState(false);
  const [settingsView, setSettingsView] = useState('main'); // 'main' | 'speed' | 'quality'
  const volumeHideTimer = useRef(null);
  const volumeSaveTimer = useRef(null);

  useImperativeHandle(ref, () => ({
    get video() { return videoRef.current; },
    play()      { return videoRef.current?.play(); },
    pause()     { videoRef.current?.pause(); },
    get muted() { return videoRef.current?.muted; },
    set muted(v){ if (videoRef.current) videoRef.current.muted = v; },
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Устанавливаем начальную громкость из настроек пользователя
    video.volume = volume;
    video.muted = muted || volume === 0;

    const isHLS = src.endsWith('.m3u8');

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ startLevel: -1, autoStartLoad: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLevels(data.levels);
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(data.level);
      });
    } else {
      video.src = src;
      if (autoPlay) video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (onTimeUpdate) onTimeUpdate();
    };
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (onLoadedMetadata) onLoadedMetadata();
    };
    const handleEnded = () => {
      setPlaying(false);
      if (onEnded) onEnded();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate, onLoadedMetadata, onEnded]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) video.pause();
    else video.play();
  };

  const handleVideoClick = (e) => {
    // Останавливаем всплытие только если есть контролы (лайтбокс)
    // В ленте постов (без контролов) клик должен всплывать к обработчику PostMedia
    if (showQuality) {
      e.stopPropagation();
      togglePlay();
    }
  };

  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const video = videoRef.current;
    if (video) video.currentTime = pct * video.duration;
  };

  const applyVolumeChange = (newVolume) => {
    setVolume(newVolume);
    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
      video.muted = newVolume === 0;
    }

    // Отложенное сохранение на сервер (debounce 1 сек)
    if (volumeSaveTimer.current) clearTimeout(volumeSaveTimer.current);
    volumeSaveTimer.current = setTimeout(() => {
      if (updateVideoVolume) updateVideoVolume(newVolume);
    }, 1000);
  };

  const handleVolumeChange = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = 1 - (y / rect.height);
    const newVolume = Math.max(0, Math.min(1, pct));
    applyVolumeChange(newVolume);
  };

  const handleVolumeMouseDown = (e) => {
    e.preventDefault();
    setDraggingVolume(true);
    handleVolumeChange(e);
  };

  useEffect(() => {
    if (!draggingVolume) return;

    const handleMouseMove = (e) => {
      const slider = document.querySelector('.vp-volume-slider');
      if (!slider) return;
      const rect = slider.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pct = 1 - (y / rect.height);
      const newVolume = Math.max(0, Math.min(1, pct));
      applyVolumeChange(newVolume);
    };

    const handleMouseUp = () => {
      setDraggingVolume(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingVolume]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || volume === 0) {
      video.muted = false;
      const newVol = volume === 0 ? 1 : volume;
      video.volume = newVol;
      setVolume(newVol);
    } else {
      video.muted = true;
      setVolume(0);
    }
  };

  const setLevel = (level) => {
    if (!hlsRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    const wasPlaying = !video.paused;
    const savedTime = video.currentTime;

    hlsRef.current.currentLevel = level;
    setCurrentLevel(level);
    setShowQualityMenu(false);
    setSettingsView('main');

    // Ждём переключения уровня и продолжаем воспроизведение
    if (wasPlaying) {
      const resumePlayback = () => {
        video.currentTime = savedTime;
        video.play().catch(() => {});
        hlsRef.current?.off(Hls.Events.LEVEL_SWITCHED, resumePlayback);
      };
      hlsRef.current.on(Hls.Events.LEVEL_SWITCHED, resumePlayback);
    }
  };

  const changePlaybackRate = (rate) => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setPlaybackRate(rate);
    setSettingsView('main');
  };

  const formatTime = (seconds) => {
    if (!isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const qualityLabel = (level) => {
    if (level === -1) return 'Auto';
    const l = levels[level];
    return l ? `${l.height}p` : `${level}`;
  };

  const handleVolumeMouseEnter = () => {
    if (volumeHideTimer.current) clearTimeout(volumeHideTimer.current);
    setShowVolumeSlider(true);
  };

  const handleVolumeMouseLeave = () => {
    volumeHideTimer.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 300);
  };

  const volumeIcon = volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';

  return (
    <div className="vp-wrapper" onClick={(e) => showQuality && e.stopPropagation()}>
      <video
        ref={videoRef}
        muted={muted}
        playsInline
        style={{ width: '100%', height: '100%', objectFit, display: 'block', background: '#000' }}
        onClick={handleVideoClick}
      />

      {showQuality && (
        <div className="vp-controls" onClick={(e) => e.stopPropagation()}>
          <div className="vp-timeline" onClick={handleTimelineClick}>
            <div
              className="vp-timeline-progress"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          <div className="vp-controls-bottom">
            <div className="vp-controls-left">
              <button className="vp-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
                {playing ? '⏸' : '▶'}
              </button>

              <div
                className="vp-volume"
                onMouseEnter={handleVolumeMouseEnter}
                onMouseLeave={handleVolumeMouseLeave}
              >
                <button className="vp-btn" onClick={toggleMute} title="Volume">
                  {volumeIcon}
                </button>
                {showVolumeSlider && (
                  <div className="vp-volume-slider" onMouseDown={handleVolumeMouseDown}>
                    <div className="vp-volume-fill" style={{ height: `${volume * 100}%` }}>
                      <div className="vp-volume-thumb" />
                    </div>
                  </div>
                )}
              </div>

              <span className="vp-time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="vp-controls-right">
              <div className="vp-quality">
                <button
                  className="vp-btn"
                  onClick={() => {
                    setShowSettings(s => !s);
                    setSettingsView('main');
                  }}
                  title="Settings"
                >
                  ⚙️
                </button>
                {showSettings && (
                  <div className="vp-settings-menu" onClick={(e) => e.stopPropagation()}>
                    {settingsView === 'main' && (
                      <>
                        <button
                          className="vp-settings-row"
                          onClick={() => setSettingsView('speed')}
                        >
                          <span className="vp-settings-icon">▶</span>
                          <div className="vp-settings-row-content">
                            <div className="vp-settings-label">{t('video.playback_speed')}</div>
                            <div className="vp-settings-value">{playbackRate === 1 ? t('video.normal') : `${playbackRate}x`}</div>
                          </div>
                          <span className="vp-settings-arrow">›</span>
                        </button>

                        {levels.length > 1 && (
                          <button
                            className="vp-settings-row"
                            onClick={() => setSettingsView('quality')}
                          >
                            <span className="vp-settings-icon">⚙</span>
                            <div className="vp-settings-row-content">
                              <div className="vp-settings-label">{t('video.quality')}</div>
                              <div className="vp-settings-value">{qualityLabel(currentLevel)}</div>
                            </div>
                            <span className="vp-settings-arrow">›</span>
                          </button>
                        )}
                      </>
                    )}

                    {settingsView === 'speed' && (
                      <>
                        <div className="vp-settings-header" onClick={() => setSettingsView('main')}>
                          <button className="vp-settings-back">‹</button>
                          <span className="vp-settings-title">{t('video.playback_speed')}</span>
                        </div>
                        <div className="vp-settings-list">
                          {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                            <button
                              key={rate}
                              className={`vp-settings-option${playbackRate === rate ? ' active' : ''}`}
                              onClick={() => changePlaybackRate(rate)}
                            >
                              {rate === 1 ? t('video.normal') : `${rate}x`}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {settingsView === 'quality' && (
                      <>
                        <div className="vp-settings-header" onClick={() => setSettingsView('main')}>
                          <button className="vp-settings-back">‹</button>
                          <span className="vp-settings-title">{t('video.quality')}</span>
                        </div>
                        <div className="vp-settings-list">
                          <button
                            className={`vp-settings-option${currentLevel === -1 ? ' active' : ''}`}
                            onClick={() => setLevel(-1)}
                          >
                            {t('video.auto')}
                          </button>
                          {[...levels].reverse().map((_, i) => {
                            const idx = levels.length - 1 - i;
                            return (
                              <button
                                key={idx}
                                className={`vp-settings-option${currentLevel === idx ? ' active' : ''}`}
                                onClick={() => setLevel(idx)}
                              >
                                {levels[idx].height}p
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
