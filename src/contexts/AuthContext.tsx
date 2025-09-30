import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

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
      const response = await apiRequest('/me');
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setUser(data.user);
        } else {
          setUser(null);
          localStorage.removeItem('sessionId'); // 清除无效的sessionId
        }
      } else {
        setUser(null);
        localStorage.removeItem('sessionId'); // 清除无效的sessionId
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      localStorage.removeItem('sessionId'); // 清除无效的sessionId
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (data.ok) {
        // 如果Safari或移动端无法使用cookie，使用localStorage存储sessionId
        if (data.sessionId) {
          localStorage.setItem('sessionId', data.sessionId);
        }
        setUser(data.user || { username });
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
      await apiRequest('/logout', { method: 'POST' });
      localStorage.removeItem('sessionId'); // 清除localStorage中的sessionId
    } catch (error) {
      console.error('Logout failed:', error);
      localStorage.removeItem('sessionId'); // 即使请求失败也清除本地存储
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