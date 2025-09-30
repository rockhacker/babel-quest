import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthUser {
  username: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // 根据环境决定API端点
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname.includes('lovableproject.com')
        ? '/api/me'
        : 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/auth/me';
        
      const response = await fetch(apiUrl, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setUser(data.user);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      // 根据环境决定API端点
      const isProduction = window.location.hostname === 'babel-quest.lovable.app';
      const apiUrl = isProduction
        ? 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/auth/login'
        : '/api/login';
        
      console.log('Attempting login to:', apiUrl, 'from:', window.location.hostname);
        
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: isProduction ? 'omit' : 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (data.ok) {
        setUser({ username });
        return { success: true };
      } else {
        return { success: false, error: data.msg || '登录失败' };
      }
    } catch (error) {
      return { success: false, error: '网络错误' };
    }
  };

  const logout = async () => {
    try {
      // 根据环境决定API端点
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname.includes('lovableproject.com')
        ? '/api/logout'
        : 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/auth/logout';
        
      await fetch(apiUrl, { 
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};