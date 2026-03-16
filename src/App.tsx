import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Classes from "./pages/Classes";
import Expenses from "./pages/Expenses";
import Instructors from "./pages/Instructors";
import Students from "./pages/Students";
import Locations from "./pages/Locations";
import Reports from "./pages/Reports";
import CashFlow from "./pages/CashFlow";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse font-display text-2xl text-muted-foreground">TRINETRA</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
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
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/instructors" element={<ProtectedRoute><Instructors /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/cash-flow" element={<ProtectedRoute><CashFlow /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
