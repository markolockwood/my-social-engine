import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { UploadProvider } from '@/context/UploadContext';
import { PostsProvider } from '@/context/PostsContext';
import GlobalUploadIndicator from '@/components/layout/GlobalUploadIndicator';
import Layout from '@/components/layout/Layout';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Profile from '@/pages/Profile';
import PostPage from '@/pages/PostPage';
import FollowList from '@/pages/FollowList';
import FollowerRequests from '@/pages/FollowerRequests';
import Settings from '@/pages/settings/Settings';
import '@/styles/App.css';

// Оборачивает приватную область (Layout с сайдбаром) целиком: если пользователь не
// авторизован — редирект на /login до того, как Layout и его дочерние роуты успеют смонтироваться.
const PrivateLayout = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Загрузка...</div>
      </div>
    );
  }

  return user ? <Layout /> : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Загрузка...</div>
      </div>
    );
  }

  return user ? <Navigate to="/" /> : children;
};

function App() {
  return (
    <AuthProvider>
      <UploadProvider>
        <PostsProvider>
          <Router>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />

              {/* Приватная область: Layout монтируется один раз, страницы рендерятся через Outlet */}
              <Route path="/" element={<PrivateLayout />}>
                <Route index element={<Home />} />
                <Route path="profile/:username" element={<Profile />} />
                <Route path="post/:id" element={<PostPage />} />
                <Route path="profile/:username/:tab" element={<FollowList />} />
                <Route path="follower-requests" element={<FollowerRequests />} />
                <Route path="settings/*" element={<Settings />} />
              </Route>

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            <GlobalUploadIndicator />
          </Router>
        </PostsProvider>
      </UploadProvider>
    </AuthProvider>
  );
}

export default App;
