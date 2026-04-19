import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo-happycash.png';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const syncRecoverySession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        toast({
          title: 'Link invalido ou expirado',
          description: error.message,
          variant: 'destructive',
        });
      }

      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setHasRecoverySession(Boolean(session));
        setCheckingSession(false);
      }

      if (event === 'SIGNED_OUT') {
        setHasRecoverySession(false);
      }
    });

    void syncRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [toast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (updatingPassword) return;

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'Use pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'As senhas nao conferem',
        description: 'Revise os dois campos e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({
          title: 'Nao foi possivel redefinir a senha',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Senha atualizada',
        description: 'Agora voce ja pode entrar com a nova senha.',
      });

      await supabase.auth.signOut({ scope: 'local' });
      navigate('/login', { replace: true });
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="relative h-[100svh] overflow-hidden bg-[#050505] px-3 py-2 sm:px-4 sm:py-3">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_42%)]" />
      <div className="relative mx-auto flex h-full w-full max-w-[23rem] items-center justify-center sm:max-w-sm">
        <div className="w-full">
          <div className="mb-2 text-center sm:mb-3">
            <img
              src={logo}
              alt="HappyCash"
              className="mx-auto h-auto w-[clamp(6.25rem,28vw,10rem)] max-w-full object-contain"
            />
            <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-yellow-200/80 sm:mt-2 sm:text-[10px] sm:tracking-[0.24em]">
              Sistema PDV • Vendas • Controle • Gestao
            </p>
          </div>

          <Card className="border-yellow-400/15 bg-black/45 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <CardHeader className="px-4 pb-1 pt-3 text-center sm:px-5 sm:pt-4">
              <CardTitle className="text-lg font-bold tracking-wide text-yellow-300 sm:text-xl">
                Redefinir Senha
              </CardTitle>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Escolha uma nova senha para continuar usando sua conta.
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3 sm:px-5 sm:pb-4">
              {checkingSession ? (
                <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando seu link...
                </div>
              ) : hasRecoverySession ? (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Minimo 6 caracteres"
                        className="h-10 border-border/70 bg-zinc-950/70 pr-10 sm:h-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(current => !current)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar senha</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repita sua nova senha"
                        className="h-10 border-border/70 bg-zinc-950/70 pr-10 sm:h-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(current => !current)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={updatingPassword}
                    className="h-10 w-full bg-yellow-400 px-4 text-sm font-semibold text-black hover:bg-yellow-300 sm:h-11"
                  >
                    {updatingPassword ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      'Salvar nova senha'
                    )}
                  </Button>
                </form>
              ) : (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    Esse link nao e mais valido ou ja expirou. Volte ao login para pedir um novo email.
                  </p>
                  <Button asChild className="h-10 w-full bg-yellow-400 text-sm font-semibold text-black hover:bg-yellow-300 sm:h-11">
                    <Link to="/login">Voltar para o login</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
