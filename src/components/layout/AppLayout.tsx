import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, IndianRupee, LogOut, Menu, X, UserPlus, Mail, Trash2, Settings as SettingsIcon, PlayCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import StudioBrand from "./StudioBrand";
import { toast } from "sonner";

const navItems = [
  { to: "/", label: "Customers", icon: Users },
  { to: "/gallery", label: "My Gallery", icon: ImageIcon },
  { to: "/media", label: "Classes", icon: PlayCircle },
  { to: "/payments", label: "Payments", icon: IndianRupee },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const InviteStaffDialog = () => {
  const { isOwner, ownerId } = useStudio();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState<{ email: string; accepted_at: string | null } | null>(null);

  const load = async () => {
    if (!ownerId) return;
    const { data } = await supabase.from("staff_invitations").select("email, accepted_at").eq("owner_id", ownerId).maybeSingle();
    setInvite(data);
  };
  useEffect(() => { if (open) load(); }, [open, ownerId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    const cleaned = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleaned)) { toast.error("Enter a valid email"); return; }
    const { error } = await supabase.from("staff_invitations").upsert({ owner_id: ownerId, email: cleaned, accepted_at: null }, { onConflict: "owner_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Invite saved — share signup link with them");
    setEmail(""); load();
  };

  const handleRevoke = async () => {
    if (!ownerId) return;
    await supabase.from("staff_invitations").delete().eq("owner_id", ownerId);
    setInvite(null);
    toast.success("Invitation revoked");
  };

  if (!isOwner) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2"><UserPlus className="h-4 w-4" />Staff</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Invite staff member</DialogTitle>
          <DialogDescription>You can invite one staff member who will share access to your studio data.</DialogDescription>
        </DialogHeader>
        {invite ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{invite.email}</p>
                <p className="text-xs text-muted-foreground">{invite.accepted_at ? "Joined" : "Pending — ask them to sign up with this email"}</p>
              </div>
              <button onClick={handleRevoke} className="text-muted-foreground hover:text-destructive p-2" aria-label="Revoke"><Trash2 className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">To invite a different person, revoke this first.</p>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label>Staff email</Label>
              <Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@example.com" maxLength={255} required />
            </div>
            <Button type="submit" className="w-full">Send Invitation</Button>
            <p className="text-xs text-muted-foreground text-center">They sign up with this email to join your workspace.</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="p-6">
          <StudioBrand />
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
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
            <div className="flex items-center justify-between p-6">
              <StudioBrand compact />
              <button onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <nav className="px-3 space-y-1">
              {navItems.map((item) => {
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
        <header className="md:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-card">
          <button onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></button>
          <StudioBrand compact />
          <div className="w-5" />
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>

        <nav className="md:hidden flex border-t border-border bg-card">
          {navItems.map((item) => {
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
    </div>
  );
};

export default AppLayout;
