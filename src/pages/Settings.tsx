import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import FavoriteCreators from "@/components/FavoriteCreators";
import SyncEmbeddingsButton from "@/components/SyncEmbeddingsButton";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const bookmarkletCode = `javascript:(function(){const s=window.getSelection().toString().trim();const u=window.location.href;const t=document.title;const SURL="${SUPABASE_URL}";const KEY="${ANON_KEY}";const sk=Object.keys(localStorage).find(k=>k.startsWith("sb-")&&k.endsWith("-auth-token"));const sess=sk?JSON.parse(localStorage.getItem(sk)):null;const tok=sess?.access_token;if(!tok){alert("Marginalia: Please log in at your app first.");return;}const payload=s?{type:"quote",url:u,text:s,title:t}:{type:"article",url:u,title:t};fetch(SURL+"/functions/v1/bookmarklet-save",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok},body:JSON.stringify(payload)}).then(r=>r.json()).then(d=>{if(d.error){alert("Marginalia: Error — "+d.error);return;}const msg=s?"Quote saved from \\""+t.slice(0,40)+"...\\"":"Article saved: \\""+t.slice(0,40)+"...\\"";const el=document.createElement("div");el.innerText="✓ Marginalia: "+msg;Object.assign(el.style,{position:"fixed",bottom:"32px",right:"32px",background:"#0f0f0f",color:"#fff",padding:"12px 20px",borderRadius:"8px",fontSize:"14px",fontFamily:"system-ui,sans-serif",zIndex:"999999",boxShadow:"0 4px 12px rgba(0,0,0,.2)",transition:"opacity .4s"});document.body.appendChild(el);setTimeout(()=>{el.style.opacity="0";},2500);setTimeout(()=>el.remove(),3000);}).catch(()=>alert("Marginalia: Could not reach the server."));})();`;

const Settings = () => {
  const { user } = useAuth();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_preferences" as any)
      .select("ai_tags_enabled, ai_chat_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setAiEnabled(data.ai_tags_enabled);
          setChatEnabled(data.ai_chat_enabled ?? true);
        }
        setLoaded(true);
      });
  }, [user]);

  const upsertPreference = async (field: string, value: boolean) => {
    if (!user) return;
    const { data: existing } = await (supabase as any)
      .from("user_preferences")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await (supabase as any)
        .from("user_preferences")
        .update({ [field]: value })
        .eq("user_id", user.id);
    } else {
      await (supabase as any)
        .from("user_preferences")
        .insert({ user_id: user.id, [field]: value });
    }
  };

  const toggleAi = async (checked: boolean) => {
    setAiEnabled(checked);
    await upsertPreference("ai_tags_enabled", checked);
  };

  const toggleChat = async (checked: boolean) => {
    setChatEnabled(checked);
    await upsertPreference("ai_chat_enabled", checked);
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
        <div className="flex items-center justify-between rounded-md border border-border p-4 mt-3">
          <div>
            <p className="text-sm font-medium text-foreground">Library chat</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chat with your saved articles and quotes using AI. Your content is used as context for answers.
            </p>
          </div>
          {loaded && (
            <Switch checked={chatEnabled} onCheckedChange={toggleChat} />
          )}
        </div>
      </section>

      {/* AI Intelligence */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-semibold text-foreground mb-6">
          AI Intelligence
        </h2>
        <SyncEmbeddingsButton userId={user.id} />
      </section>

      {/* Favorite Creators */}
      <FavoriteCreators />

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

      {/* Claude Desktop — Power User */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-semibold text-foreground mb-2">
          Claude Desktop
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Connect Claude Desktop to your Marginalia library. Once set up, you can ask Claude questions like <em>"What did I save about pricing strategy?"</em> and it will search your notes directly.
        </p>

        <div className="rounded-xl border border-border overflow-hidden">
          {/* Step 1 */}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-foreground mb-1">Step 1 — Get your API key</p>
            <p className="text-xs text-muted-foreground">
              Your Marginalia MCP API key is stored in your <code className="bg-muted px-1 py-0.5 rounded text-[11px]">user_preferences</code> row under <code className="bg-muted px-1 py-0.5 rounded text-[11px]">mcp_api_key</code>. Generate one in Supabase or ask your admin.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-foreground mb-2">Step 2 — Add to Claude Desktop config</p>
            <p className="text-xs text-muted-foreground mb-3">
              Open <code className="bg-muted px-1 py-0.5 rounded text-[11px]">~/Library/Application Support/Claude/claude_desktop_config.json</code> and add this block:
            </p>
            <div className="relative group">
              <pre className="text-[11px] bg-muted rounded-lg p-3 overflow-x-auto leading-relaxed text-foreground/80">{`{
  "mcpServers": {
    "marginalia": {
      "url": "${SUPABASE_URL}/functions/v1/mcp",
      "headers": {
        "x-api-key": "YOUR_MARGINALIA_API_KEY"
      }
    }
  }
}`}</pre>
              <button
                onClick={() => {
                  const config = `{\n  "mcpServers": {\n    "marginalia": {\n      "url": "${SUPABASE_URL}/functions/v1/mcp",\n      "headers": {\n        "x-api-key": "YOUR_MARGINALIA_API_KEY"\n      }\n    }\n  }\n}`;
                  navigator.clipboard.writeText(config);
                  toast.success("Config copied to clipboard");
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-background border border-border rounded px-2 py-1 text-muted-foreground hover:text-foreground"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Available tools */}
          <div className="p-4">
            <p className="text-xs font-semibold text-foreground mb-2">Available tools</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {["listTags", "listArticlesByTag", "listQuotesByTag", "search", "getThreadBySessionId"].map((tool) => (
                <code key={tool} className="text-[11px] bg-muted rounded px-2 py-1 text-muted-foreground">{tool}</code>
              ))}
            </div>
          </div>
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
