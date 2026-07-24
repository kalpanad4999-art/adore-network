import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SupportChatWidget from "@/components/SupportChatWidget";
import chatbotAvatarAsset from "@/assets/chatbot-avatar.png.asset.json";

const PublicChat = () => {
  const { ownerId } = useParams<{ ownerId: string }>();
  const [studioName, setStudioName] = useState("Trinetra Yoga");

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("studio_settings")
        .select("studio_name")
        .eq("user_id", ownerId)
        .maybeSingle();
      if (data?.studio_name) setStudioName(data.studio_name);
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
        <img
          src={chatbotAvatarAsset.url}
          alt={`${studioName} assistant`}
          className="h-24 w-24 rounded-full mx-auto shadow ring-2 ring-primary/20 object-cover bg-background"
          width={96}
          height={96}
        />
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
