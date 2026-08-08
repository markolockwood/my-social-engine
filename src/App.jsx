import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';
import { PostsProvider } from './context/PostsContext';
import GlobalUploadIndicator from './components/GlobalUploadIndicator';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import PostPage from './pages/PostPage';
import FollowList from './pages/FollowList';
import './styles/App.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Загрузка...</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
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
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile/:username"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />
              <Route
                path="/post/:id"
                element={
                  <PrivateRoute>
                    <PostPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile/:username/:tab"
                element={
                  <PrivateRoute>
                    <FollowList />
                  </PrivateRoute>
                }
              />
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
