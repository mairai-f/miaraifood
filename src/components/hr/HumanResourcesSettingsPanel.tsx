import { Link } from 'react-router-dom';
import { BriefcaseBusiness, Clock3, FileCheck2, ShieldCheck, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const hrCapabilities = [
  { label: 'Colaboradores', description: 'Cadastro funcional, documentos, cargo, admissao e desligamento.', icon: UsersRound },
  { label: 'Ponto e escalas', description: 'Jornadas, tolerancias, ajustes, abonos e relatorios.', icon: Clock3 },
  { label: 'Folha e eventos', description: 'Base para fechamento, exportacao e trilha de auditoria.', icon: FileCheck2 },
  { label: 'Acesso isolado', description: 'Quem entra como RH enxerga somente o modulo RH no menu lateral.', icon: ShieldCheck },
];

export function HumanResourcesSettingsPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BriefcaseBusiness className="h-4 w-4 text-primary" />
              Recursos Humanos
            </CardTitle>
            <Badge variant="outline">Plano completo</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Ative a funcao RH em Configuracoes &gt; Colaboradores. O administrador confirma com login e senha,
            escolhe o tipo de acesso RH e libera apenas as permissoes do modulo.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {hrCapabilities.map((capability) => (
            <div key={capability.label} className="rounded-lg border border-border/70 bg-background/70 p-4">
              <capability.icon className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-semibold">{capability.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{capability.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxo recomendado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">1. Criar acesso</p>
              <p className="mt-2 text-sm">Cadastre o colaborador em Colaboradores e selecione tipo de acesso RH.</p>
            </div>
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">2. Permissoes</p>
              <p className="mt-2 text-sm">Libere somente as acoes de RH necessarias para aquela pessoa.</p>
            </div>
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">3. Operacao</p>
              <p className="mt-2 text-sm">O colaborador entra pelo login operacional e acessa apenas o menu RH.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/configuracoes/colaboradores?modal=cadastrar-operador&tipo=rh">Autorizar colaborador RH</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/rh">Abrir modulo RH</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
