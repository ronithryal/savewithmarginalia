import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Hash, Search, LogOut, Settings } from "lucide-react";

const TopNav = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const links = [
    { to: "/", label: "Home", icon: null },
    { to: "/articles", label: "Articles", icon: FileText },
    { to: "/quotes", label: "Quotes", icon: BookOpen },
    { to: "/tags", label: "Tags", icon: Hash },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="border-b border-border">
      <div className="mx-auto max-w-4xl flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-foreground">
            Marginalia
          </Link>
          <div className="hidden sm:flex items-center gap-1">
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
            <Link
              to="/search"
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                location.pathname === "/search"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Search
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/search">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Search className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
