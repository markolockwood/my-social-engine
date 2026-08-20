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

// Автоматическое обновление токена при истечении
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Обработка ошибок и автоматический refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если 401 и это не повторная попытка и не запрос на refresh
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {

      if (isRefreshing) {
        // Если уже идёт обновление токена, добавляем запрос в очередь
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        // Нет refresh токена — очищаем всё и редиректим на логин
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        // Запрашиваем новый access token
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        const newAccessToken = data.accessToken;

        // Сохраняем новый токен
        localStorage.setItem('token', newAccessToken);

        // Обновляем токен в заголовке оригинального запроса
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        // Обрабатываем очередь запросов
        processQueue(null, newAccessToken);

        isRefreshing = false;

        // Повторяем оригинальный запрос с новым токеном
        return api(originalRequest);

      } catch (err) {
        // Refresh token тоже протух или невалиден — logout
        processQueue(err, null);
        isRefreshing = false;

        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';

        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register:       (data)  => api.post('/auth/register', data),
  login:          (data)  => api.post('/auth/login', data),
  logout:         (data)  => api.post('/auth/logout', data),
  refresh:        (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  getMe:          ()      => api.get('/auth/me'),
  getAccountInfo: ()      => api.get('/user/account-info'),
  updateTheme:    (theme) => api.patch('/user/theme',    { theme }),
  updateLanguage: (lang)  => api.patch('/user/language', { language: lang }),
  updateProfile:  (data)  => api.patch('/user/profile', data),
  updateVideoVolume: (volume) => api.patch('/user/video-volume', { volume }),
  updateProtectedPosts: (protectedPosts) => api.patch('/user/protected-posts', { protected_posts: protectedPosts }),
  updateUsername: (username) => api.patch('/user/username', { username }),
  updateCountry:  (country)  => api.patch('/user/country', { country }),
  updateGender:   (gender)   => api.patch('/user/gender', { gender }),
  uploadAvatar:   (file)  => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post('/upload/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getFollowRequests: () => api.get('/user/follow-requests'),
  getFollowRequestsCount: () => api.get('/user/follow-requests/count'),
  acceptFollowRequest: (username) => api.post(`/user/follow-requests/${username}/accept`),
  declineFollowRequest: (username) => api.post(`/user/follow-requests/${username}/decline`),
  cancelFollowRequest: (username) => api.delete(`/user/follow-requests/${username}`)
};

export const postsAPI = {
  getFeed:    (limit = 20, offset = 0) => api.get(`/posts?limit=${limit}&offset=${offset}`),
  create:     (content, mediaFiles = [], parentId = null, isQuickReply = false) =>
    api.post('/posts', { content, media_files: mediaFiles, parent_id: parentId, is_quick_reply: isQuickReply }),
  getById:    (id) => api.get(`/posts/${id}`),
  delete:     (id) => api.delete(`/posts/${id}`),
  like:       (id) => api.post(`/posts/${id}/like`),
  unlike:     (id) => api.post(`/posts/${id}/unlike`),
  getReplies: (id, limit = 50, offset = 0) => api.get(`/posts/${id}/replies?limit=${limit}&offset=${offset}`),
  getCounters: (id) => api.get(`/posts/${id}/counters`),
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
  follow:         (username)                         => api.post(`/users/${username}/follow`),
  unfollow:       (username)                         => api.delete(`/users/${username}/follow`),
  getFollowers:   (username, limit = 20, offset = 0) =>
    api.get(`/users/${username}/followers?limit=${limit}&offset=${offset}`),
  getFollowing:   (username, limit = 20, offset = 0) =>
    api.get(`/users/${username}/following?limit=${limit}&offset=${offset}`),
};

export default api;
