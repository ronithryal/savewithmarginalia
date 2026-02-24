import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import TopNav from "@/components/TopNav";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Articles from "./pages/Articles";
import ArticleDetail from "./pages/ArticleDetail";
import Quotes from "./pages/Quotes";
import Tags from "./pages/Tags";
import Settings from "./pages/Settings";
import ShareTarget from "./pages/ShareTarget";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <>
      <TopNav />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/articles/:id" element={<ArticleDetail />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/share-target" element={<ShareTarget />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
