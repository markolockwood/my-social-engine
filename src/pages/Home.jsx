import React, { useState, useEffect, useRef } from 'react';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import ComposePost from '@/components/compose/ComposePost';
import Post from '@/components/post/Post';
import './Home.css';

/**
 * Главная страница - лента новостей
 * Показывает оригинальные посты + быстрые ответы (is_quick_reply = true) с quoted posts
 */
const Home = () => {
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]       = useState('');
  const [newPosts, setNewPosts] = useState([]);
  const [hasMore, setHasMore]   = useState(true);
  const latestIdRef             = useRef(0);
  const offsetRef               = useRef(0);
  const observerRef             = useRef(null);
  const { t } = useAuth();

  useEffect(() => { loadPosts(true); }, []);

  const loadPosts = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const limit = isInitial ? 25 : 15;
      const response = await postsAPI.getFeed(limit, offsetRef.current);
      const postsData = response.data.posts;

      // Если вернулось меньше постов, чем запрошено - это последняя страница
      if (postsData.length < limit) {
        setHasMore(false);
      }

      // Загружаем родительские посты для быстрых ответов (is_quick_reply = true)
      // Они будут отображаться как quoted posts внутри твитов
      const postsWithParents = await Promise.all(
        postsData.map(async (post) => {
          if (post.parent_id && post.is_quick_reply) {
            try {
              const parentRes = await postsAPI.getById(post.parent_id);
              return { ...post, quotedPost: parentRes.data.post };
            } catch {
              return post;
            }
          }
          return post;
        })
      );

      if (isInitial) {
        setPosts(postsWithParents);
        latestIdRef.current = postsWithParents[0]?.id || 0;
      } else {
        setPosts(prev => [...prev, ...postsWithParents]);
      }

      offsetRef.current += postsData.length;
    } catch (err) {
      setError(t('feed.error'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
    latestIdRef.current = Math.max(latestIdRef.current, newPost.id);
    offsetRef.current += 1; // Увеличиваем offset так как добавили пост
  };
  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter((p) => p.id !== postId));
    offsetRef.current = Math.max(0, offsetRef.current - 1); // Уменьшаем offset
  };

  const handleShowNewPosts = () => {
    setPosts(prev => [...newPosts, ...prev]);
    latestIdRef.current = newPosts[0]?.id || latestIdRef.current;
    offsetRef.current += newPosts.length; // Увеличиваем offset на количество новых постов
    setNewPosts([]);
  };

  // Intersection Observer для определения когда пользователь достиг конца списка
  const lastPostRef = useRef(null);

  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadPosts(false);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (lastPostRef.current) {
      observer.observe(lastPostRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, loadingMore, hasMore, posts.length]);

  useEffect(() => {
    const poll = async () => {
      try {
        // Для проверки новых постов загружаем только первые 25
        const res = await postsAPI.getFeed(25, 0);
        const fetched = res.data.posts;
        const fresh = fetched.filter(p => p.id > latestIdRef.current);
        if (fresh.length === 0) return;
        const enriched = await Promise.all(
          fresh.map(async (post) => {
            if (post.parent_id && post.is_quick_reply) {
              try {
                const parentRes = await postsAPI.getById(post.parent_id);
                return { ...post, quotedPost: parentRes.data.post };
              } catch { return post; }
            }
            return post;
          })
        );
        setNewPosts(enriched);
      } catch {}
    };
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <main className="main">
        <div className="main-header">
          <h2>{t('feed.title')}</h2>
        </div>

        <ComposePost onPostCreated={handlePostCreated} />

        {newPosts.length > 0 && (
          <button className="new-posts-btn" onClick={handleShowNewPosts}>
            {t('post_page.show_new_posts').replace('{{count}}', newPosts.length)}
          </button>
        )}

        {loading && (
          <div className="loading-container">
            <div className="loading-spinner">{t('feed.loading')}</div>
          </div>
        )}

        {error && <div className="error-container">{error}</div>}

        {!loading && posts.length === 0 && (
          <div className="empty-state"><p>{t('feed.empty')}</p></div>
        )}

        {!loading && posts.map((post, index) => {
          // Добавляем ref к последнему посту для Intersection Observer
          const isLastPost = index === posts.length - 1;
          return (
            <div key={post.id} ref={isLastPost ? lastPostRef : null}>
              <Post post={post} quotedPost={post.quotedPost} onDelete={handlePostDeleted} />
            </div>
          );
        })}

        {loadingMore && (
          <div className="loading-container">
            <div className="loading-spinner">{t('feed.loading')}</div>
          </div>
        )}

        {!loading && !loadingMore && !hasMore && posts.length > 0 && (
          <div className="empty-state">
            <p>{t('feed.no_more_posts') || 'Больше постов нет'}</p>
          </div>
        )}
      </main>

      <aside className="right">
        <div className="search-box">🔍 {t('feed.search')}</div>
        <div className="panel">
          <h3>{t('feed.trending')}</h3>
          <div className="panel-item">
            <div className="trend-category">Technologies · Trending</div>
            <div className="trend-name">#JavaScript</div>
            <div className="trend-count">12.5K posts</div>
          </div>
          <div className="panel-item">
            <div className="trend-category">Programming</div>
            <div className="trend-name">#ReactJS</div>
            <div className="trend-count">8.2K posts</div>
          </div>
          <div className="panel-item">
            <div className="trend-category">Technologies</div>
            <div className="trend-name">#WebDev</div>
            <div className="trend-count">15.7K posts</div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Home;
