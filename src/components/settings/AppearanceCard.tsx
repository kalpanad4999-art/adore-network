import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sun, Moon, Check } from "lucide-react";
import { toast } from "sonner";

export const AppearanceCard = () => {
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />} Appearance
        </CardTitle>
        <CardDescription>Choose how TRINETRA YOGA looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button type="button" onClick={() => { setTheme("light"); toast.success("Light mode on"); }}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 transition-all ${theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
            <Sun className="h-5 w-5" /><span className="font-medium">Light</span>
            {theme === "light" && <Check className="h-4 w-4 text-primary ml-1" />}
          </button>
          <button type="button" onClick={() => { setTheme("dark"); toast.success("Dark mode on"); }}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 transition-all ${theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
            <Moon className="h-5 w-5" /><span className="font-medium">Dark</span>
            {theme === "dark" && <Check className="h-4 w-4 text-primary ml-1" />}
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppearanceCard;
