/**
 * API工具类 - 处理不同环境下的API调用
 * 开发环境使用 /api/*
 * 生产环境使用完整的Supabase边缘函数URL
 */

// 获取正确的API基础URL
function getApiBaseUrl(): string {
  const hostname = window.location.hostname;
  
  // 检查是否在开发环境或预览环境
  if (hostname === 'localhost' || hostname === '127.0.0.1' || 
      hostname.includes('lovableproject.com') || hostname.includes('lovable.app') ||
      hostname.includes('preview--')) {
    return '/api';
  }
  
  // 生产环境使用完整URL
  return 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/api';
}

// 获取请求配置
function getRequestConfig(): RequestInit {
  const hostname = window.location.hostname;
  
  // 开发环境和预览环境使用include，生产环境使用omit
  const isDevOrPreview = hostname === 'localhost' || hostname === '127.0.0.1' || 
                        hostname.includes('lovableproject.com') || hostname.includes('lovable.app') ||
                        hostname.includes('preview--');
  
  return {
    credentials: isDevOrPreview ? 'include' as RequestCredentials : 'omit'
  };
}

// 统一的API请求函数
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const config = getRequestConfig();
  
  
  console.log('API Request Debug:', {
    hostname: window.location.hostname,
    baseUrl,
    endpoint,
    url,
    credentials: config.credentials
  });
  
  const finalOptions: RequestInit = {
    ...config,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  return fetch(url, finalOptions);
}

// 便捷方法
export const api = {
  get: (endpoint: string) => apiRequest(endpoint),
  post: (endpoint: string, data?: any) => apiRequest(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  }),
  put: (endpoint: string, data?: any) => apiRequest(endpoint, {
    method: 'PUT', 
    body: data ? JSON.stringify(data) : undefined,
  }),
  delete: (endpoint: string) => apiRequest(endpoint, {
    method: 'DELETE',
  }),
};