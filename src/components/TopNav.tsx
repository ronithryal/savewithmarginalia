import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Hash, Search, LogOut, Settings, Compass, Menu, X } from "lucide-react";
import { useState } from "react";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

const TopNav = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!user) return null;

  const links = [
    { to: "/", label: "Home", icon: null },
    { to: "/articles", label: "Articles", icon: FileText },
    { to: "/quotes", label: "Quotes", icon: BookOpen },
    { to: "/tags", label: "Tags", icon: Hash },
    { to: "/chat", label: "Chat", icon: null },
    { to: "/discover", label: "Discover", icon: Compass },
    { to: "/settings", label: "Settings", icon: Settings },
    { to: "/future", label: "Future", icon: null },
  ];

  return (
    <>
      <nav className="border-b border-border">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-8">
            {isMobile && (
              <button onClick={() => setDrawerOpen(true)} className="text-foreground -ml-1" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
            )}
            <Link to="/" className="font-display text-lg font-bold tracking-tight text-foreground">
              Marginalia
            </Link>
            {!isMobile && (
              <div className="flex items-center gap-1">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      location.pathname === link.to
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/search">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Search className="h-4 w-4" />
              </Button>
            </Link>
            {!isMobile && (
              <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="left">
        <DrawerContent className="fixed inset-y-0 left-0 w-[280px] rounded-none rounded-r-xl h-full border-r border-border">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
            <span className="font-display text-lg font-bold text-foreground">Marginalia</span>
            <DrawerClose asChild>
              <button className="text-muted-foreground hover:text-foreground" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </div>
          <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  location.pathname === link.to
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {link.icon && <link.icon className="h-4 w-4" />}
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border px-3 py-4">
            <button
              onClick={() => { setDrawerOpen(false); signOut(); }}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md w-full transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default TopNav;
