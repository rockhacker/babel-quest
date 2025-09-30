// 通用API工具函数
export const getApiUrl = (endpoint: string): string => {
  const isProduction = window.location.hostname === 'babel-quest.lovable.app';
  const baseUrl = isProduction 
    ? 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/api'
    : '/api';
  
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

export const getApiConfig = () => {
  const isProduction = window.location.hostname === 'babel-quest.lovable.app';
  return {
    credentials: isProduction ? 'omit' as RequestCredentials : 'include' as RequestCredentials,
  };
};

export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = getApiUrl(endpoint);
  const config = getApiConfig();
  
  const response = await fetch(url, {
    ...config,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  return response;
};