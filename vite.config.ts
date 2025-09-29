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
          if (path.startsWith('/api/login') || path.startsWith('/api/logout') || path.startsWith('/api/me')) {
            return path.replace('/api', '/auth');
          }
          return path.replace('/api', '/api');
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