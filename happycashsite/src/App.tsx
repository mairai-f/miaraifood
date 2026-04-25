import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Pix from "./pages/Pix.tsx";
import Login from "./pages/Login.tsx";
import Cadastro from "./pages/Cadastro.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import DownloadRedirect from "./pages/DownloadRedirect.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import FiadoDigital from "./pages/FiadoDigital.tsx";
import SistemaPdv from "./pages/SistemaPdv.tsx";
import ControleEstoque from "./pages/ControleEstoque.tsx";
import NotFound from "./pages/NotFound.tsx";
import { LocaleProvider } from "../../shared/locale/LocaleContext";

const queryClient = new QueryClient();

const App = () => (
  <LocaleProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/pix" element={<Pix />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/caderneta-de-fiado-digital" element={<FiadoDigital />} />
            <Route path="/sistema-pdv" element={<SistemaPdv />} />
            <Route path="/controle-de-estoque" element={<ControleEstoque />} />
            <Route path="/downloads/:platform" element={<DownloadRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </LocaleProvider>
);

export default App;
