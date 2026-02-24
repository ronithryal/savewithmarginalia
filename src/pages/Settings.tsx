import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const bookmarkletCode = `javascript:(function(){const s=window.getSelection().toString().trim();const u=window.location.href;const t=document.title;const SURL="${SUPABASE_URL}";const KEY="${ANON_KEY}";const sk=Object.keys(localStorage).find(k=>k.startsWith("sb-")&&k.endsWith("-auth-token"));const sess=sk?JSON.parse(localStorage.getItem(sk)):null;const tok=sess?.access_token;if(!tok){alert("Marginalia: Please log in at your app first.");return;}const payload=s?{type:"quote",url:u,text:s,title:t}:{type:"article",url:u,title:t};fetch(SURL+"/functions/v1/bookmarklet-save",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok},body:JSON.stringify(payload)}).then(r=>r.json()).then(d=>{if(d.error){alert("Marginalia: Error — "+d.error);return;}const msg=s?"Quote saved from \\""+t.slice(0,40)+"...\\"":"Article saved: \\""+t.slice(0,40)+"...\\"";const el=document.createElement("div");el.innerText="✓ Marginalia: "+msg;Object.assign(el.style,{position:"fixed",bottom:"32px",right:"32px",background:"#0f0f0f",color:"#fff",padding:"12px 20px",borderRadius:"8px",fontSize:"14px",fontFamily:"system-ui,sans-serif",zIndex:"999999",boxShadow:"0 4px 12px rgba(0,0,0,.2)",transition:"opacity .4s"});document.body.appendChild(el);setTimeout(()=>{el.style.opacity="0";},2500);setTimeout(()=>el.remove(),3000);}).catch(()=>alert("Marginalia: Could not reach the server."));})();`;

const Settings = () => {
  const { user } = useAuth();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_preferences" as any)
      .select("ai_tags_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setAiEnabled(data.ai_tags_enabled);
        setLoaded(true);
      });
  }, [user]);

  const toggleAi = async (checked: boolean) => {
    if (!user) return;
    setAiEnabled(checked);
    const { data: existing } = await (supabase as any)
      .from("user_preferences")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await (supabase as any)
        .from("user_preferences")
        .update({ ai_tags_enabled: checked })
        .eq("user_id", user.id);
    } else {
      await (supabase as any)
        .from("user_preferences")
        .insert({ user_id: user.id, ai_tags_enabled: checked });
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 animate-fade-in">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-10">
        Settings
      </h1>

      {/* AI Features */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-semibold text-foreground mb-6">
          AI Features
        </h2>
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Tag suggestions</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When you save an article or quote, Marginalia uses AI to suggest relevant tags from your library.
            </p>
          </div>
          {loaded && (
            <Switch checked={aiEnabled} onCheckedChange={toggleAi} />
          )}
        </div>
      </section>

      {/* Save from anywhere */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-semibold text-foreground mb-6">
          Save from anywhere
        </h2>

        {/* Bookmarklet */}
        <div className="mb-10">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Bookmarklet (desktop)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drag this button to your bookmarks bar. Click it on any page to save an article, or select text first to save a quote.
          </p>
          <a
            href={bookmarkletCode}
            onClick={(e) => e.preventDefault()}
            draggable
            className="inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors cursor-grab active:cursor-grabbing"
          >
            Save to Marginalia
          </a>
          <p className="text-xs text-muted-foreground mt-3">
            You must be logged into Marginalia in the same browser for this to work.
          </p>
        </div>

        {/* Mobile PWA */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Mobile (iOS & Android)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Tap the Share button in your browser, then tap "Add to Home Screen" to install Marginalia. After installing, any link you share will show Marginalia as an option.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Open Marginalia in Safari or Chrome on your phone</li>
            <li>Tap the Share button and select "Add to Home Screen"</li>
            <li>Now share any link from any app and tap "Marginalia" to save it</li>
          </ol>
        </div>
      </section>

      {/* Developer tools – only in dev */}
      {import.meta.env.DEV && (
        <section className="mb-12">
          <h2 className="font-display text-xl font-semibold text-foreground mb-6">
            Developer tools
          </h2>
          <div className="flex items-center justify-between rounded-md border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Re-clean tweet text</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Applies the latest cleaning regex to all existing articles with residual t.co / pic.twitter.com links.
              </p>
            </div>
            <RecleanButton userId={user.id} />
          </div>
        </section>
      )}
    </div>
  );
};

function cleanTweetText(text: string): string {
  return text
    .replace(/https?:\/\/t\.co\/\S+/gi, "")
    .replace(/pic\.twitter\.com\/\S+/gi, "")
    .replace(/pic\.x\.com\/\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function RecleanButton({ userId }: { userId: string }) {
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const { data: articles } = await supabase
        .from("articles")
        .select("id, content_text")
        .eq("user_id", userId)
        .not("content_text", "is", null);

      let updated = 0;
      for (const a of articles || []) {
        if (!a.content_text) continue;
        if (!/t\.co\/|pic\.twitter\.com|pic\.x\.com/i.test(a.content_text)) continue;
        const cleaned = cleanTweetText(a.content_text);
        if (cleaned !== a.content_text) {
          await supabase.from("articles").update({ content_text: cleaned }).eq("id", a.id);
          updated++;
        }
      }
      toast.success(`Cleaned ${updated} article(s).`);
    } catch {
      toast.error("Failed to clean tweets.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={running}>
      {running ? "Cleaning…" : "Run"}
    </Button>
  );
}

export default Settings;
