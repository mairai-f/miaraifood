import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-happycash.png";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Planos", href: "#planos" },
    { label: "Screenshots", href: "#screenshots" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled 
        ? "bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-background/50" 
        : "bg-transparent"
    }`}>
      <div className="container flex h-20 items-center justify-between">
        <a href="#" className="flex items-center gap-2 group">
          <img src={logo} alt="HappyCash" className="h-11 w-auto transition-transform duration-300 group-hover:scale-105" />
        </a>

        <nav className="hidden md:flex items-center gap-10">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-primary after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <a href="/login">Entrar</a>
          </Button>
          <Button asChild className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:scale-105">
            <a href="#planos">Começar Agora</a>
          </Button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl animate-fade-in">
          <nav className="container flex flex-col gap-4 py-6">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <Button asChild className="w-full bg-primary text-primary-foreground font-semibold">
              <a href="#planos" onClick={() => setMobileOpen(false)}>Começar Agora</a>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
