import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 全局重定向检测 - 在React应用启动前运行
function checkGlobalRedirect() {
  const path = window.location.pathname;
  const match = path.match(/\/admin\/r\/([a-f0-9]+)$/) || path.match(/\/r\/([a-f0-9]+)$/);
  
  if (match) {
    const token = match[1];
    console.log('Global redirect detected for token:', token);
    
    const redirectUrl = `https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/${token}`;
    console.log('Global redirecting to:', redirectUrl);
    
    // 立即重定向，不加载React应用
    window.location.replace(redirectUrl);
    return true;
  }
  return false;
}

// 检查是否需要重定向，如果不需要才加载React应用
if (!checkGlobalRedirect()) {
  createRoot(document.getElementById("root")!).render(<App />);
}
