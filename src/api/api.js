import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Обработка ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register:       (data)  => api.post('/auth/register', data),
  login:          (data)  => api.post('/auth/login', data),
  getMe:          ()      => api.get('/auth/me'),
  updateTheme:    (theme) => api.patch('/user/theme',    { theme }),
  updateLanguage: (lang)  => api.patch('/user/language', { language: lang }),
  updateProfile:  (data)  => api.patch('/user/profile', data),
  updateVideoVolume: (volume) => api.patch('/user/video-volume', { volume }),
  uploadAvatar:   (file)  => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post('/upload/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
};

export const postsAPI = {
  getFeed:    (limit = 20, offset = 0) => api.get(`/posts?limit=${limit}&offset=${offset}`),
  create:     (content, mediaFiles = [], parentId = null, isQuickReply = false) =>
    api.post('/posts', { content, media_files: mediaFiles, parent_id: parentId, is_quick_reply: isQuickReply }),
  getById:    (id) => api.get(`/posts/${id}`),
  delete:     (id) => api.delete(`/posts/${id}`),
  like:       (id) => api.post(`/posts/${id}/like`),
  unlike:     (id) => api.post(`/posts/${id}/unlike`),
  getReplies: (id) => api.get(`/posts/${id}/replies`),
  incrementView: (id) => api.post(`/posts/${id}/view`),
  deleteMedia: (url) => api.delete('/upload/media', { data: { url } }),
  cancelUpload: (trackingId) => api.delete('/upload/cancel', { data: { tracking_id: trackingId } }),
  getTempUploads: () => api.get('/temp-uploads'),
  uploadImages: (files, config = {}) => {
    const form = new FormData();
    files.forEach(file => form.append('images[]', file));
    return api.post('/upload/post-images', form, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(config.headers || {})
      }
    });
  },
  uploadGif: (file, config = {}) => {
    const form = new FormData();
    form.append('gif', file);
    return api.post('/upload/post-gif', form, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(config.headers || {})
      }
    });
  },
  uploadVideo: (file, config = {}) => {
    const form = new FormData();
    form.append('video', file);
    return api.post('/upload/post-video', form, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(config.headers || {})
      }
    });
  }
};

export const usersAPI = {
  getByUsername:  (username)                         => api.get(`/users/${username}`),
  getUserPosts:   (username, limit = 20, offset = 0) =>
    api.get(`/users/${username}/posts?limit=${limit}&offset=${offset}`),
  getUserReplies: (username, limit = 20, offset = 0) =>
    api.get(`/users/${username}/replies?limit=${limit}&offset=${offset}`),
};

export default api;
