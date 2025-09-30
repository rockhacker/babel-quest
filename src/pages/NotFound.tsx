import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.log('NotFound page, current path:', location.pathname);
    
    // 检查是否是重定向URL
    const match = location.pathname.match(/\/admin\/r\/([a-f0-9]+)$/) || location.pathname.match(/\/r\/([a-f0-9]+)$/);
    if (match) {
      const token = match[1];
      console.log('Found redirect token in NotFound:', token);
      
      const redirectUrl = `https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/${token}`;
      console.log('Redirecting from NotFound to:', redirectUrl);
      
      // 立即重定向
      window.location.replace(redirectUrl);
      return;
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">页面未找到</p>
        <a
          href="/admin"
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          返回首页
        </a>
      </div>
    </div>
  );
};

export default NotFound;