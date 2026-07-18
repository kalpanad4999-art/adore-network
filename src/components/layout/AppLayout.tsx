import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, IndianRupee, LogOut, Menu, X, UserPlus, Mail, Trash2, Settings as SettingsIcon, PlayCircle, Image as ImageIcon, CalendarClock, Fingerprint, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

import SupportChatWidget from "@/components/SupportChatWidget";
import { toast } from "sonner";
import { useWallpaper } from "@/hooks/useWallpaper";

import { ModuleKey } from "@/contexts/StudioContext";

const navItems: { to: string; label: string; icon: any; module: ModuleKey | null }[] = [
  { to: "/", label: "Members", icon: Users, module: "customers" },
  { to: "/attendance", label: "Attendance", icon: Fingerprint, module: "attendance" },
  { to: "/gallery", label: "My Gallery", icon: ImageIcon, module: "gallery" },
  { to: "/media", label: "Classes", icon: PlayCircle, module: "classes" },
  { to: "/payments", label: "Payments", icon: IndianRupee, module: "payments" },
  { to: "/offers", label: "Offers", icon: Gift, module: "payments" },
  { to: "/renewals", label: "Renewals", icon: CalendarClock, module: "renewals" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, module: null },
];

const InviteStaffDialog = () => {
  const { isOwner } = useStudio();
  if (!isOwner) return null;
  return (
    <Link
      to="/settings"
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
    >
      <UserPlus className="h-4 w-4" /> Staff &amp; Permissions
    </Link>
  );
};


const AppLayout = ({ children }: { children: ReactNode }) => {
  const { signOut } = useAuth();
  const { ownerId, isOwner, permissions } = useStudio();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const visibleNav = navItems.filter((n) => isOwner || n.module === null || permissions[n.module]);
  const wp = useWallpaper();

  const wallpaperActive = wp.mode !== "none";
  const rootStyle: React.CSSProperties =
    wp.mode === "image" && wp.image
      ? { backgroundImage: `url(${wp.image})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }
      : wp.mode === "color" && wp.color
      ? { background: wp.color }
      : {};

  return (
    <div className={`flex min-h-screen ${wallpaperActive ? "" : "bg-background"}`} style={rootStyle}>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="p-6" />

        <nav className="flex-1 px-3 space-y-1">
          {visibleNav.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          <InviteStaffDialog />
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-border animate-fade-in">
            <div className="flex items-center justify-end p-4">
              <button onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>

            <nav className="px-3 space-y-1">
              {visibleNav.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border space-y-1">
              <InviteStaffDialog />
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="md:hidden flex items-center border-b border-border px-4 py-3 bg-card">
          <button onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>

        <nav className="md:hidden flex border-t border-border bg-card">
          {visibleNav.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </main>
      {ownerId && <SupportChatWidget ownerId={ownerId} />}
    </div>
  );
};

export default AppLayout;
