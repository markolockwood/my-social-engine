import React, { useState, useEffect, useRef } from 'react';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import ComposePost from '../components/ComposePost';
import Post from '../components/Post';
import '../styles/Home.css';

/**
 * Главная страница - лента новостей
 * Показывает оригинальные посты + быстрые ответы (is_quick_reply = true) с quoted posts
 */
const Home = () => {
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [newPosts, setNewPosts] = useState([]);
  const latestIdRef             = useRef(0);
  const { t } = useAuth();

  useEffect(() => { loadPosts(); }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const response = await postsAPI.getFeed();
      const postsData = response.data.posts;

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

      setPosts(postsWithParents);
      latestIdRef.current = postsWithParents[0]?.id || 0;
    } catch (err) {
      setError(t('feed.error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
    latestIdRef.current = Math.max(latestIdRef.current, newPost.id);
  };
  const handlePostDeleted = (postId) => setPosts(prev => prev.filter((p) => p.id !== postId));

  const handleShowNewPosts = () => {
    setPosts(prev => [...newPosts, ...prev]);
    latestIdRef.current = newPosts[0]?.id || latestIdRef.current;
    setNewPosts([]);
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await postsAPI.getFeed();
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
    <div className="layout">
      <Sidebar />

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

        {!loading && posts.map((post) => (
          <Post key={post.id} post={post} quotedPost={post.quotedPost} onDelete={handlePostDeleted} />
        ))}
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

      <MobileNav />
    </div>
  );
};

export default Home;
