import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

/**
 * Контекст для глобального управления состоянием постов
 * Обеспечивает синхронизацию данных между компонентами:
 * - Лайки
 * - Количество комментариев
 * - Просмотры
 * - Автообновление относительного времени
 */
const PostsContext = createContext();

export const PostsProvider = ({ children }) => {
  // Хранилище состояний постов: postId -> { isLiked, likesCount, commentsCount, viewsCount }
  const [postsState, setPostsState] = useState({});

  // Посты, для которых запрос на просмотр уже отправлен в текущей SPA-сессии.
  // Ref, а не state — не должен вызывать перерендер, нужен только для дедупликации запросов
  const viewedPostsRef = useRef(new Set());

  // Принудительное обновление для пересчета времени
  const [timeUpdateTrigger, setTimeUpdateTrigger] = useState(0);

  // Обновляем таймер каждую минуту для пересчета относительного времени
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUpdateTrigger(prev => prev + 1);
    }, 60000); // каждую минуту

    return () => clearInterval(interval);
  }, []);

  /**
   * Инициализация состояния поста
   */
  const initPost = useCallback((postId, initialState) => {
    setPostsState(prev => {
      if (prev[postId]) return prev; // Уже инициализирован
      return {
        ...prev,
        [postId]: {
          isLiked: initialState.isLiked || false,
          likesCount: parseInt(initialState.likesCount) || 0,
          commentsCount: parseInt(initialState.commentsCount) || 0,
          viewsCount: parseInt(initialState.viewsCount) || 0,
        }
      };
    });
  }, []);

  /**
   * Обновление состояния поста (частичное)
   */
  const updatePost = useCallback((postId, updates) => {
    setPostsState(prev => ({
      ...prev,
      [postId]: {
        ...(prev[postId] || {}),
        ...updates
      }
    }));
  }, []);

  /**
   * Переключение лайка
   */
  const toggleLike = useCallback((postId) => {
    setPostsState(prev => {
      const current = prev[postId] || {};
      const newIsLiked = !current.isLiked;
      return {
        ...prev,
        [postId]: {
          ...current,
          isLiked: newIsLiked,
          likesCount: (current.likesCount || 0) + (newIsLiked ? 1 : -1)
        }
      };
    });
  }, []);

  /**
   * Увеличение счетчика комментариев
   */
  const incrementComments = useCallback((postId, delta = 1) => {
    setPostsState(prev => {
      const current = prev[postId] || {};
      return {
        ...prev,
        [postId]: {
          ...current,
          commentsCount: Math.max(0, (current.commentsCount || 0) + delta)
        }
      };
    });
  }, []);

  /**
   * Увеличение счетчика просмотров
   */
  const incrementViews = useCallback((postId, delta = 1) => {
    setPostsState(prev => {
      const current = prev[postId] || {};
      return {
        ...prev,
        [postId]: {
          ...current,
          viewsCount: (current.viewsCount || 0) + delta
        }
      };
    });
  }, []);

  /**
   * Отмечает пост как просмотренный в текущей сессии.
   * Возвращает true при первой отметке (запрос на /view нужно отправить),
   * false если запрос для этого поста уже отправлялся — избегаем повторных
   * запросов при каждом повторном попадании поста в вьюпорт ленты.
   */
  const markPostViewed = useCallback((postId) => {
    if (viewedPostsRef.current.has(postId)) return false;
    viewedPostsRef.current.add(postId);
    return true;
  }, []);

  /**
   * Получение состояния поста
   */
  const getPostState = useCallback((postId) => {
    return postsState[postId] || null;
  }, [postsState]);

  /**
   * Очистка состояния поста (при удалении)
   */
  const removePost = useCallback((postId) => {
    setPostsState(prev => {
      const newState = { ...prev };
      delete newState[postId];
      return newState;
    });
  }, []);

  const value = {
    postsState,
    timeUpdateTrigger,
    initPost,
    updatePost,
    toggleLike,
    incrementComments,
    incrementViews,
    markPostViewed,
    getPostState,
    removePost
  };

  return (
    <PostsContext.Provider value={value}>
      {children}
    </PostsContext.Provider>
  );
};

export const usePostsContext = () => {
  const context = useContext(PostsContext);
  if (!context) {
    throw new Error('usePostsContext must be used within PostsProvider');
  }
  return context;
};
