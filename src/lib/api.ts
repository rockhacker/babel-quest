/**
 * API工具类 - 处理不同环境下的API调用
 * 使用 Supabase 客户端进行身份验证
 */

import { supabase } from '@/integrations/supabase/client';

// 获取正确的API基础URL
function getApiBaseUrl(): string {
  const hostname = window.location.hostname;
  
  // 检查是否在开发/预览环境 (明确的开发/预览域名)
  const isDevOrPreview = hostname === 'localhost' || 
                        hostname === '127.0.0.1' || 
                        hostname.includes('lovableproject.com') ||
                        hostname.includes('preview--');
  
  if (isDevOrPreview) {
    return '/api';
  }
  
  // 生产环境使用 Supabase 函数 URL
  return 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/api';
}

// 统一的API请求函数
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // Get current session token
  const { data: { session } } = await supabase.auth.getSession();
  
  const finalOptions: RequestInit = {
    credentials: 'include' as RequestCredentials,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
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