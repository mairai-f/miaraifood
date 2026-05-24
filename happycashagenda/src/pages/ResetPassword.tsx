import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Lock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const passwordRegex =
  /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]).{8,}$/;

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Senha deve ter no mínimo 8 caracteres")
      .regex(
        passwordRegex,
        "Senha deve ter pelo menos 1 letra maiúscula e 1 símbolo especial (!@#$%^&*()_+-=[]{};':\"|<>?,./`~)",
      ),
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = resetSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      toast({
        title: "Dados inválidos",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({
        title: "Erro ao atualizar senha",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Senha atualizada",
      description:
        "Sua senha foi atualizada com sucesso. Faça login novamente.",
    });

    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4">
          <CardTitle>Nova senha</CardTitle>
          <CardDescription>Insira sua nova senha abaixo.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasSession === false ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="w-5 h-5" />
                <span>
                  Não foi possível validar sua sessão. Utilize o link enviado
                  por email para acessar esta página.
                </span>
              </div>
              <Button className="w-full" onClick={() => navigate("/login")}>
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <PasswordInput
                  id="newPassword"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  iconLeft={<Lock className="w-4 h-4" />}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  iconLeft={<Lock className="w-4 h-4" />}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aguarde...
                  </>
                ) : (
                  "Atualizar senha"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
