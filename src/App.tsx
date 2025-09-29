import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/admin/Dashboard";
import Catalog from "@/pages/admin/Catalog";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            } />
            <Route path="/admin/catalog" element={
              <AdminLayout>
                <Catalog />
              </AdminLayout>
            } />
            <Route path="/admin/inventory" element={
              <AdminLayout>
                <div>库存管理页面开发中...</div>
              </AdminLayout>
            } />
            <Route path="/admin/replicas" element={
              <AdminLayout>
                <div>副本管理页面开发中...</div>
              </AdminLayout>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
