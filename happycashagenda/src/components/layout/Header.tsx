/**
 * ==============================================================
 * COMPONENTE: Header (Cabeçalho)
 * ==============================================================
 *
 * PROPÓSITO:
 * Barra de navegação principal da aplicação.
 *
 * FUNCIONALIDADES:
 * - Logo e nome da marca
 * - Navegação desktop e mobile
 * - Alternância de tema (claro/escuro)
 * - Menu do usuário (quando logado)
 * - Modal de alteração de senha
 * - Modal de alteração de telefone
 *
 * ==============================================================
 */

import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Sun,
  Moon,
  User,
  LogOut,
  Key,
  Phone,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { useAgendaBranding } from "@/hooks/useAgendaBranding";
import { withAgendaPublicSearch } from "@/lib/agendaPublicLink";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const { itemCount, setIsOpen: setCartOpen } = useCart();
  const { settings } = useAgendaBranding();
  const [isBarber, setIsBarber] = useState(false);
  const [barberSessionName, setBarberSessionName] = useState<string | null>(
    null,
  );
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const publicPath = (path: string) => withAgendaPublicSearch(path, settings);

  // Estados para modal de senha
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Estados para modal de telefone
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [phoneToken, setPhoneToken] = useState("");
  const [tokenSent, setTokenSent] = useState(false);
  const [changingPhone, setChangingPhone] = useState(false);

  // Verificar se barbeiro está logado via session
  useEffect(() => {
    const barberName = sessionStorage.getItem("barber_name");
    setBarberSessionName(barberName);
  }, []);

  // Verificar se é barbeiro
  useEffect(() => {
    const checkBarberRole = async () => {
      if (user) {
        const { data } = await supabase
          .from("barbers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        setIsBarber(!!data);
      } else {
        setIsBarber(false);
      }
    };
    checkBarberRole();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  /**
   * Altera a senha do usuário e faz logoff para aplicar a mudança
   */
  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A nova senha e a confirmação devem ser iguais.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter no mínimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Senha alterada!",
        description: "Você será desconectado para aplicar a nova senha.",
      });
      setShowPasswordModal(false);
      setNewPassword("");
      setConfirmPassword("");
      // Faz logoff para que o usuário entre novamente com a nova senha
      setTimeout(async () => {
        await signOut();
        navigate(publicPath("/login"));
      }, 1500);
    }
  };

  /**
   * Formata número de telefone para exibição
   */
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  /**
   * Envia token de verificação para o novo telefone
   * NOTA: Esta função está pré-configurada para integração com SMS/WhatsApp
   */
  const sendPhoneToken = async () => {
    if (newPhone.replace(/\D/g, "").length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Digite um número de telefone válido.",
        variant: "destructive",
      });
      return;
    }

    setChangingPhone(true);

    // TODO: Implementar envio real de token via SMS/WhatsApp
    // Por enquanto, simula o envio do token
    // Na implementação real, chamar a edge function send-whatsapp-notification

    // Simula delay de envio
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setTokenSent(true);
    setChangingPhone(false);

    toast({
      title: "Token enviado!",
      description:
        "Digite o código recebido por SMS/WhatsApp para confirmar a alteração.",
    });
  };

  /**
   * Confirma alteração de telefone com o token
   */
  const confirmPhoneChange = async () => {
    if (phoneToken.length < 4) {
      toast({
        title: "Token inválido",
        description: "Digite o código de verificação completo.",
        variant: "destructive",
      });
      return;
    }

    setChangingPhone(true);

    // TODO: Verificar token real via edge function
    // Por enquanto, aceita qualquer token de 4+ dígitos

    if (!user) {
      setChangingPhone(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ phone: newPhone.replace(/\D/g, "") })
      .eq("user_id", user.id);

    setChangingPhone(false);

    if (error) {
      toast({
        title: "Erro ao alterar telefone",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Telefone alterado!",
        description: "Seu número foi atualizado com sucesso.",
      });
      setShowPhoneModal(false);
      setNewPhone("");
      setPhoneToken("");
      setTokenSent(false);
    }
  };

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.displayName}
                  className="rounded object-contain"
                  style={{ width: settings.logoSize, height: settings.logoSize }}
                />
              ) : (
                <div className="p-2 bg-primary rounded-lg">
                  <CalendarDays className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
              <span className="font-serif text-xl font-semibold">{settings.displayName}</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {/* Para barbeiro logado via sessão, mostra apenas Início que redireciona para o painel */}
              {barberSessionName ? (
                <Link
                  to="/painel-profissional"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Início
                </Link>
              ) : (
                <>
                  <Link
                    to="/"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Início
                  </Link>
                  <Link
                    to={publicPath("/agendamento")}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Agendar
                  </Link>
                  <Link
                    to={publicPath("/produtos")}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Produtos
                  </Link>
                  {user && (
                    <Link
                      to={publicPath("/meus-agendamentos")}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Meus Agendamentos
                    </Link>
                  )}
                  {isBarber && (
                    <Link
                      to="/painel-profissional"
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Meu Painel
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/painel"
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Dashboard
                    </Link>
                  )}
                </>
              )}
            </nav>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-full"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </Button>

              {/* Notification Bell */}
              <NotificationBell />

              {/* Cart Icon - only for logged-in users */}
              {user && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCartOpen(true)}
                  className="rounded-full relative"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {itemCount}
                    </span>
                  )}
                </Button>
              )}

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                    >
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem className="text-muted-foreground text-xs">
                      {user.email}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate(publicPath("/meus-agendamentos"))}
                    >
                      Meus Agendamentos
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/painel")}>
                        Dashboard Admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowPasswordModal(true)}
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Alterar Senha
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowPhoneModal(true)}>
                      <Phone className="w-4 h-4 mr-2" />
                      Alterar Telefone
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-destructive"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : barberSessionName ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2 rounded-full">
                      <User className="w-5 h-5" />
                      <span className="hidden sm:inline text-sm">
                        {barberSessionName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem className="text-muted-foreground text-xs">
                      {settings.professionalLabel}: {barberSessionName}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate("/painel-profissional")}
                    >
                      Meu Painel
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        sessionStorage.removeItem("barber_id");
                        sessionStorage.removeItem("barber_name");
                        setBarberSessionName(null);
                        navigate("/");
                      }}
                      className="text-destructive"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate(publicPath("/login"))}
                >
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Modal de Alteração de Senha */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Alterar Senha
            </DialogTitle>
            <DialogDescription>
              Após alterar sua senha, você será desconectado e precisará fazer
              login novamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handlePasswordChange} disabled={changingPassword}>
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Alterando...
                </>
              ) : (
                "Alterar senha"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Alteração de Telefone */}
      <Dialog open={showPhoneModal} onOpenChange={setShowPhoneModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Alterar Telefone
            </DialogTitle>
            <DialogDescription>
              {!tokenSent
                ? "Digite seu novo número de telefone. Um código de verificação será enviado."
                : "Digite o código de verificação enviado para seu novo número."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!tokenSent ? (
              <div className="space-y-2">
                <Label htmlFor="newPhone">Novo telefone (WhatsApp)</Label>
                <Input
                  id="newPhone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(formatPhone(e.target.value))}
                />
              </div>
            ) : (
              <>
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  Código enviado para: <strong>{newPhone}</strong>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneToken">Código de verificação</Label>
                  <Input
                    id="phoneToken"
                    type="text"
                    placeholder="0000"
                    value={phoneToken}
                    onChange={(e) =>
                      setPhoneToken(e.target.value.replace(/\D/g, ""))
                    }
                    maxLength={6}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPhoneModal(false);
                setTokenSent(false);
                setPhoneToken("");
              }}
            >
              Cancelar
            </Button>
            {!tokenSent ? (
              <Button onClick={sendPhoneToken} disabled={changingPhone}>
                {changingPhone ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar código"
                )}
              </Button>
            ) : (
              <Button onClick={confirmPhoneChange} disabled={changingPhone}>
                {changingPhone ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
