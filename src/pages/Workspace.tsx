import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dexVaultApi, DexFileMeta, DexWorkspace } from "@/integrations/dex/vault";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Play } from "lucide-react";

export default function Workspace() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [workspace, setWorkspace] = useState<DexWorkspace | null>(null);
  const [files, setFiles] = useState<DexFileMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Grouped files
  const signals = files.filter(f => f.type === 'intel');
  const nextBets = files.filter(f => f.type === 'next_bet');
  const specs = files.filter(f => f.type === 'spec' || f.type === 'doc');
  const learnings = files.filter(f => f.type === 'learning');

  useEffect(() => {
    async function loadWorkspaceData() {
      if (!slug) return;
      setIsLoading(true);
      try {
        // Fetch workspace metadata
        const spaces = await dexVaultApi.getWorkspaces();
        const found = spaces.find(s => s.slug === slug);
        if (found) {
          setWorkspace(found);
        } else {
          toast({ title: "Workspace not found", variant: "destructive" });
        }

        // Fetch files for workspace
        const fetchedFiles = await dexVaultApi.getWorkspaceFiles(slug);
        setFiles(fetchedFiles);
      } catch (err: any) {
        toast({ title: "Error loading vault data", description: err.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    loadWorkspaceData();
  }, [slug, toast]);

  const handleRunSkill = async (skill: string) => {
    if (!slug) return;
    toast({ title: `Triggering ${skill}...` });
    try {
      const res = await dexVaultApi.triggerSkill(skill, slug);
      toast({ title: "Skill executed", description: res.message });
      // In a real implementation we would poll or subscribe to vault changes
    } catch (err: any) {
      toast({ title: "Error running skill", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading Dex Vault...</div>;
  }

  if (!workspace) {
    return <div className="p-8">Workspace not found</div>;
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-8 animate-in fade-in zoom-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">{workspace.name}</h1>
          <p className="text-lg text-muted-foreground mt-2">{workspace.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleRunSkill('propose_next_bets')}>
            <Play className="w-4 h-4 mr-2" />
            Propose Bets
          </Button>
          <Button onClick={() => handleRunSkill('morning_intel')}>
            <Play className="w-4 h-4 mr-2" />
            Morning Intel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Signals / Intel */}
        <Card>
          <CardHeader>
            <CardTitle>Signals & Intel</CardTitle>
            <CardDescription>Generated locally into 06-Resources/Intel/</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {signals.length === 0 ? <p className="text-sm text-muted-foreground">No intel found.</p> : null}
            {signals.map(file => (
              <div key={file.id} className="p-3 border rounded-md hover:border-primary cursor-pointer transition-colors">
                <div className="font-medium">{file.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(file.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Next Bets */}
        <Card>
          <CardHeader>
            <CardTitle>Next Bets</CardTitle>
            <CardDescription>Tasks linked to this Area in 03-Tasks/Tasks.md</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextBets.length === 0 ? <p className="text-sm text-muted-foreground">No bets proposed.</p> : null}
            {nextBets.map(file => (
              <div key={file.id} className="flex items-center justify-between p-3 border rounded-md hover:border-primary cursor-pointer transition-colors">
                <div className="font-medium">{file.title}</div>
                <span className="text-xs px-2 py-1 bg-secondary rounded-full uppercase tracking-wider">
                  {file.status || 'draft'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Area Docs */}
        <Card>
          <CardHeader>
            <CardTitle>Area & Project Docs</CardTitle>
            <CardDescription>Markdown files natively stored in this Dex folder</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {specs.length === 0 ? <p className="text-sm text-muted-foreground">No specs found.</p> : null}
            {specs.map(file => (
              <div key={file.id} className="p-3 border rounded-md hover:border-primary cursor-pointer transition-colors">
                <div className="font-medium">{file.title}</div>
                <div className="text-xs text-muted-foreground mt-1">status: {file.status || 'draft'}</div>
              </div>
            ))}
            <Button variant="ghost" className="w-full justify-start text-muted-foreground">+ New Spec</Button>
          </CardContent>
        </Card>

        {/* Learnings */}
        <Card>
          <CardHeader>
            <CardTitle>Learnings</CardTitle>
            <CardDescription>Future: Sync from Dex 06-Resources/Learnings/</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {learnings.length === 0 ? <p className="text-sm text-muted-foreground">No learnings recorded.</p> : null}
            {learnings.map(file => (
              <div key={file.id} className="p-3 border rounded-md hover:border-primary cursor-pointer transition-colors">
                <div className="font-medium flex items-center gap-2">
                  <span>{file.status === 'final' ? '✅' : '⏳'}</span>
                  {file.title}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
