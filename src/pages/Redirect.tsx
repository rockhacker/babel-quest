import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

const Redirect = () => {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    if (token) {
      // 直接重定向到Supabase边缘函数
      const redirectUrl = `https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/${token}`;
      console.log('Redirecting mobile to:', redirectUrl);
      window.location.href = redirectUrl;
    }
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">正在跳转到目标页面...</p>
        {token && (
          <p className="text-sm text-gray-400 mt-2">
            如果没有自动跳转，请
            <a 
              href={`https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/${token}`}
              className="text-blue-600 underline ml-1"
            >
              点击这里
            </a>
          </p>
        )}
      </div>
    </div>
  );
};

export default Redirect;