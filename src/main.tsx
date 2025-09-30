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
    
    // 在页面上显示重定向信息，便于调试
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial;">
        <h2>重定向调试信息</h2>
        <p>当前路径: ${path}</p>
        <p>检测到Token: ${token}</p>
        <p>重定向URL: ${redirectUrl}</p>
        <p>User Agent: ${navigator.userAgent}</p>
        <p>正在重定向...</p>
        <a href="${redirectUrl}" style="color: blue;">点击这里手动跳转</a>
      </div>
    `;
    
    // 立即重定向，不加载React应用
    setTimeout(() => {
      window.location.replace(redirectUrl);
    }, 1000);
    return true;
  }
  return false;
}

// 检查是否需要重定向，如果不需要才加载React应用
if (!checkGlobalRedirect()) {
  createRoot(document.getElementById("root")!).render(<App />);
}
