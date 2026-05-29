import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AgendaBrandingProvider } from "@/hooks/useAgendaBranding";
import { ThemeProvider } from "@/hooks/useTheme";
import { CartProvider } from "@/hooks/useCart";
import { CartDrawer } from "@/components/cart/CartDrawer";
import Seo from "@/components/Seo";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Agendamento from "./pages/Agendamento";
import MeusAgendamentos from "./pages/MeusAgendamentos";
import Painel from "./pages/Painel";
import PainelBarbeiro from "./pages/PainelBarbeiro";
import Produtos from "./pages/Produtos";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <AgendaBrandingProvider>
            <CartProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <CartDrawer />
                <Seo />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/agendamento" element={<Agendamento />} />
                  <Route
                    path="/meus-agendamentos"
                    element={<MeusAgendamentos />}
                  />
                  <Route path="/painel" element={<Painel />} />
                  <Route path="/painel-barbeiro" element={<PainelBarbeiro />} />
                  <Route path="/painel-profissional" element={<PainelBarbeiro />} />
                  <Route path="/produtos" element={<Produtos />} />
                  <Route path="/auth" element={<Login />} />
                  <Route path="/booking" element={<Agendamento />} />
                  <Route path="/my-appointments" element={<MeusAgendamentos />} />
                  <Route path="/admin" element={<Painel />} />
                  <Route path="/barber" element={<PainelBarbeiro />} />
                  <Route path="/professional" element={<PainelBarbeiro />} />
                  <Route path="/products" element={<Produtos />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/:businessSlug" element={<Index />} />
                  <Route path="/:businessSlug/agendamento" element={<Agendamento />} />
                  <Route path="/:businessSlug/login" element={<Login />} />
                  <Route path="/:businessSlug/meus-agendamentos" element={<MeusAgendamentos />} />
                  <Route path="/:businessSlug/produtos" element={<Produtos />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </TooltipProvider>
            </CartProvider>
          </AgendaBrandingProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
