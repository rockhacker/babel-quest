import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/admin/r': {
        target: 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect',
        changeOrigin: true,
        secure: true,
        followRedirects: false,
        rewrite: (path) => {
          console.log('Redirecting admin path:', path);
          // 将 /admin/r/token 转换为 /r/token
          return path.replace('/admin', '');
        }
      },
      '/r': {
        target: 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect',
        changeOrigin: true,
        secure: true,
        followRedirects: false,
        rewrite: (path) => {
          console.log('Redirecting path:', path);
          return path; // 保持原路径，让redirect函数处理token提取
        }
      },
      '/api': {
        target: 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1',
        changeOrigin: true,
        secure: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying request to:', proxyReq.path);
          });
        },
        rewrite: (path) => {
          console.log('Original API path:', path);
          if (path.startsWith('/api/login') || path.startsWith('/api/logout') || path.startsWith('/api/me')) {
            // 提取端点名称，如 login, logout, me  
            const endpoint = path.replace('/api/', '');
            const newPath = `/auth/${endpoint}`;
            console.log('Auth path rewritten to:', newPath);
            return newPath;
          }
          // 对于其他API路径，保持原始路径
          console.log('General API path kept as:', path);
          return path;
        }
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));