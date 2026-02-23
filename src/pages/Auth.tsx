import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground mb-2">
          Marginalia
        </h1>
        <p className="text-muted-foreground mb-10 text-sm">
          Save articles. Capture quotes. Build knowledge.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-11"
          />
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "..." : isSignUp ? "Sign up" : "Sign in"}
          </Button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
};

export default Auth;
