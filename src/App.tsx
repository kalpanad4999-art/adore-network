import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StudioProvider } from "@/contexts/StudioContext";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Customers from "./pages/Customers";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
import Join from "./pages/Join";
import NotFound from "./pages/NotFound";
import PaymentsGuard from "./components/PaymentsGuard";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse font-display text-2xl text-muted-foreground">Loading…</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <StudioProvider>
      <AppLayout>{children}</AppLayout>
    </StudioProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/join/:token" element={<Join />} />
            <Route path="/" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><PaymentsGuard><Payments /></PaymentsGuard></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/students" element={<Navigate to="/" replace />} />
            <Route path="/classes" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
