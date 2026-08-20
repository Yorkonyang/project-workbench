import axios from 'axios';
import { useAuthStore, TOKEN_KEY } from '../store/useAuthStore';

const client = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// 请求拦截：自动带 token
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：统一处理 success/error
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject({ message: '登录已过期，请重新登录' });
    }
    const msg = error.response?.data?.error?.message || error.message || '请求失败';
    return Promise.reject({ message: msg, code: error.response?.data?.error?.code });
  }
);

export default client;
