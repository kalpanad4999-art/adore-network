import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StudioProvider } from "@/contexts/StudioContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import AppLockGuard from "@/components/AppLockGuard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Customers from "./pages/Customers";
import Payments from "./pages/Payments";
import Renewals from "./pages/Renewals";
import Settings from "./pages/Settings";
import Join from "./pages/Join";
import Media from "./pages/Media";
import Gallery from "./pages/Gallery";
import Attendance from "./pages/Attendance";
import BiometricSettings from "./pages/BiometricSettings";
import Offers from "./pages/Offers";
import PublicStudio from "./pages/PublicStudio";
import PublicRecording from "./pages/PublicRecording";
import PublicGallery from "./pages/PublicGallery";
import PublicRecordings from "./pages/PublicRecordings";
import PublicChat from "./pages/PublicChat";

import NotFound from "./pages/NotFound";
import PaymentsGuard from "./components/PaymentsGuard";
import PermissionGuard from "./components/PermissionGuard";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse font-display text-2xl text-muted-foreground">Loading…</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <StudioProvider>
      <AppLockGuard>
        <AppLayout>{children}</AppLayout>
      </AppLockGuard>
    </StudioProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/join/:token" element={<Join />} />
            <Route path="/studio/:ownerId" element={<PublicStudio />} />
            <Route path="/r/:slug" element={<PublicRecording />} />
            <Route path="/gallery/:ownerId" element={<PublicGallery />} />
            <Route path="/recordings/:ownerId" element={<PublicRecordings />} />
            <Route path="/" element={<ProtectedRoute><PermissionGuard module="customers"><Customers /></PermissionGuard></ProtectedRoute>} />
            <Route path="/gallery" element={<ProtectedRoute><PermissionGuard module="gallery"><Gallery /></PermissionGuard></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><PermissionGuard module="attendance"><Attendance /></PermissionGuard></ProtectedRoute>} />
            <Route path="/settings/biometric" element={<ProtectedRoute><BiometricSettings /></ProtectedRoute>} />
            <Route path="/media" element={<ProtectedRoute><PermissionGuard module="classes"><Media /></PermissionGuard></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><PermissionGuard module="payments"><PaymentsGuard><Payments /></PaymentsGuard></PermissionGuard></ProtectedRoute>} />
            <Route path="/renewals" element={<ProtectedRoute><PermissionGuard module="renewals"><Renewals /></PermissionGuard></ProtectedRoute>} />
            <Route path="/offers" element={<ProtectedRoute><PermissionGuard module="payments"><Offers /></PermissionGuard></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/:section" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/students" element={<Navigate to="/" replace />} />
            <Route path="/classes" element={<Navigate to="/media" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
