import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SupportChatWidget from "@/components/SupportChatWidget";
import { MessageCircle } from "lucide-react";

const PublicChat = () => {
  const { ownerId } = useParams<{ ownerId: string }>();
  const [studioName, setStudioName] = useState("Trinetra Yoga");
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("studio_settings")
        .select("studio_name, logo_url")
        .eq("user_id", ownerId)
        .maybeSingle();
      if (data?.studio_name) setStudioName(data.studio_name);
      if (data?.logo_url) setLogo(data.logo_url);
      document.title = `${data?.studio_name || "Trinetra Yoga"} · Chat`;

    })();
  }, [ownerId]);

  if (!ownerId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Invalid chatbot link.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-10">
      <div className="max-w-md w-full text-center space-y-4">
        {logo ? (
          <img src={logo} alt={studioName} className="h-20 w-20 rounded-full object-cover mx-auto shadow" />
        ) : (
          <div className="h-20 w-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-9 w-9 text-primary" />
          </div>
        )}
        <h1 className="font-display text-3xl">{studioName}</h1>
        <p className="text-muted-foreground">
          Chat with us for membership, renewals, class schedules, payments and general support.
        </p>
      </div>
      <SupportChatWidget ownerId={ownerId} autoOpen />
    </div>
  );
};

export default PublicChat;
