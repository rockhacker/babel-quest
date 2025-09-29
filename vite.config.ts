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
      '/r': {
        target: 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect',
        changeOrigin: true,
        rewrite: (path) => path.replace('/r', '')
      },
      '/api': {
        target: 'https://isfxgcfocfctwixklbvw.supabase.co/functions/v1',
        changeOrigin: true,
        rewrite: (path) => {
          console.log('Rewriting path:', path);
          if (path === '/api/login' || path === '/api/logout' || path === '/api/me') {
            const newPath = path.replace('/api', '/auth');
            console.log('Auth path rewritten to:', newPath);
            return newPath;
          }
          const newPath = path.replace('/api', '/api');
          console.log('API path rewritten to:', newPath);
          return newPath;
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