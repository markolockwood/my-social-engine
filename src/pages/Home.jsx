import React, { useState, useEffect } from 'react';
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
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
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
    } catch (err) {
      setError(t('feed.error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = (newPost) => setPosts([newPost, ...posts]);
  const handlePostDeleted = (postId)  => setPosts(posts.filter((p) => p.id !== postId));

  return (
    <div className="layout">
      <Sidebar />

      <main className="main">
        <div className="main-header">
          <h2>{t('feed.title')}</h2>
        </div>

        <ComposePost onPostCreated={handlePostCreated} />

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
