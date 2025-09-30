import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 全局重定向检测 - 在React应用启动前运行
function checkGlobalRedirect() {
  const path = window.location.pathname;
  console.log('Checking global redirect for path:', path);
  console.log('Full URL:', window.location.href);
  console.log('User agent:', navigator.userAgent);
  
  const match = path.match(/\/admin\/r\/([a-f0-9]+)$/) || path.match(/\/r\/([a-f0-9]+)$/);
  
  if (match) {
    const token = match[1];
    console.log('Global redirect detected for token:', token);
    
    const redirectUrl = `https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/${token}`;
    console.log('Global redirecting to:', redirectUrl);
    
    // 显示重定向页面
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial; text-align: center; background: #f5f5f5; min-height: 100vh; display: flex; flex-direction: column; justify-content: center;">
        <div style="max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="width: 40px; height: 40px; border: 4px solid #ddd; border-top: 4px solid #007AFF; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
          <h2 style="margin: 0 0 15px; color: #333;">正在跳转...</h2>
          <p style="color: #666; margin: 0 0 20px;">检测到Token: ${token}</p>
          <a href="${redirectUrl}" style="color: #007AFF; text-decoration: none; font-size: 16px;" onclick="window.location.href='${redirectUrl}'; return false;">点击这里手动跳转</a>
        </div>
        <style>
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </div>
    `;
    
    // 立即重定向
    setTimeout(() => {
      window.location.replace(redirectUrl);
    }, 500);
    return true;
  }
  return false;
}

// 检查是否需要重定向，如果不需要才加载React应用
if (!checkGlobalRedirect()) {
  createRoot(document.getElementById("root")!).render(<App />);
}
