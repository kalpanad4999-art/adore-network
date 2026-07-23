import { Link, Navigate, useParams } from "react-router-dom";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Palette, Lock, ShieldCheck, Users, Bot, Crown, ChevronRight, ArrowLeft, Wallpaper,
} from "lucide-react";
import AppearanceCard from "@/components/settings/AppearanceCard";
import AppLockCard from "@/components/settings/AppLockCard";
import SecurityCard from "@/components/settings/SecurityCard";
import WallpaperCard from "@/components/settings/WallpaperCard";
import { StaffPermissionsCard } from "@/components/StaffPermissionsCard";
import { ChatbotKnowledgeCard } from "@/components/ChatbotKnowledgeCard";
import { OwnerInfoCard } from "@/components/OwnerInfoCard";

type Section = {
  slug: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
  render: () => JSX.Element;
};

const SECTIONS: Section[] = [
  {
    slug: "appearance",
    title: "Appearance",
    subtitle: "Theme, light and dark mode",
    icon: Palette,
    render: () => <AppearanceCard />,
  },
  {
    slug: "wallpaper",
    title: "Wallpaper",
    subtitle: "Choose an image from gallery or set a background color",
    icon: Wallpaper,
    render: () => <WallpaperCard />,
  },
  {
    slug: "app-lock",
    title: "App Lock",
    subtitle: "Set, change, enable or disable your PIN",
    icon: Lock,
    ownerOnly: true,
    render: () => <AppLockCard />,
  },
  {
    slug: "security",
    title: "Security",
    subtitle: "Payment Lock, password and fingerprint unlock",
    icon: ShieldCheck,
    ownerOnly: true,
    render: () => <SecurityCard />,
  },
  {
    slug: "staff",
    title: "Staff & Permissions",
    subtitle: "Invite staff, accounts and module permissions",
    icon: Users,
    ownerOnly: true,
    render: () => <StaffPermissionsCard />,
  },
  {
    slug: "chatbot",
    title: "AI Chatbot",
    subtitle: "Knowledge base, questions, test, import/export, history",
    icon: Bot,
    ownerOnly: true,
    render: () => <ChatbotKnowledgeCard />,
  },
  {
    slug: "owner",
    title: "Owner",
    subtitle: "View the permanent studio owner account",
    icon: Crown,
    ownerOnly: true,
    render: () => <OwnerInfoCard />,
  },
];

const Settings = () => {
  const { isOwner } = useStudio();
  const { section } = useParams<{ section?: string }>();

  const visible = SECTIONS.filter((s) => !s.ownerOnly || isOwner);

  if (section) {
    const found = visible.find((s) => s.slug === section);
    if (!found) return <Navigate to="/settings" replace />;
    const Icon = found.icon;
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to Settings">
            <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex items-center gap-2">
            <Icon className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl text-foreground">{found.title}</h1>
          </div>
        </div>
        {found.render()}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your studio's look and security.</p>
      </div>

      <div className="space-y-3">
        {visible.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.slug} to={`/settings/${s.slug}`} className="block group">
              <Card className="transition-all hover:border-primary/40 hover:shadow-sm">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg text-foreground">{s.title}</div>
                    <div className="text-sm text-muted-foreground truncate">{s.subtitle}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Settings;
