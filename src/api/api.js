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
  uploadAvatar:   (file)  => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post('/upload/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
};

export const postsAPI = {
  getFeed:    (limit = 20, offset = 0) => api.get(`/posts?limit=${limit}&offset=${offset}`),
  create:     (content, parentId = null, isQuickReply = false) =>
    api.post('/posts', { content, parent_id: parentId, is_quick_reply: isQuickReply }),
  getById:    (id) => api.get(`/posts/${id}`),
  delete:     (id) => api.delete(`/posts/${id}`),
  like:       (id) => api.post(`/posts/${id}/like`),
  unlike:     (id) => api.post(`/posts/${id}/unlike`),
  retweet:    (id) => api.post(`/posts/${id}/retweet`),
  unretweet:  (id) => api.post(`/posts/${id}/unretweet`),
  getReplies: (id) => api.get(`/posts/${id}/replies`),
};

export const usersAPI = {
  getByUsername:  (username)                         => api.get(`/users/${username}`),
  getUserPosts:   (username, limit = 20, offset = 0) =>
    api.get(`/users/${username}/posts?limit=${limit}&offset=${offset}`),
  getUserReplies: (username, limit = 20, offset = 0) =>
    api.get(`/users/${username}/replies?limit=${limit}&offset=${offset}`),
};

export default api;
