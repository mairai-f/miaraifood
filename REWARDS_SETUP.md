# Setup da Tabela de Recompensas

## 🚀 Como Ativar o Sistema de Recompensas

### Opção 1: Via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase:** https://app.supabase.com
2. **Selecione seu projeto:** `ymffclntmynwfdiarlaw`
3. **Vá para SQL Editor** (lado esquerdo)
4. **Clique em "New Query"**
5. **Cole o seguinte SQL:**

```sql
-- Criar tabela Rewards
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  minimum_spending NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
CREATE POLICY "Authenticated users can view rewards" ON public.rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rewards" ON public.rewards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rewards" ON public.rewards FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete rewards" ON public.rewards FOR DELETE TO authenticated USING (true);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON public.rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

6. **Clique em "Run"** (ou Ctrl+Enter)
7. ✅ **Pronto!** A tabela foi criada

---

### Opção 2: Via Terminal (Se o Supabase CLI estiver authenticado)

```bash
cd /home/celio/Documentos/testehappycash
supabase db push
```

---

## ✨ Funcionalidades que Ficarão Disponíveis

✅ **Criar Recompensas** - Configure metas e prêmios  
✅ **Editar Recompensas** - Atualize informações a qualquer momento  
✅ **Deletar Recompensas** - Remova recompensas inativas  
✅ **Acesso de Clientes** - Veja quais prêmios eles podem ganhar  

---

## 📋 Exemplo de Recompensa

| Nome | Descrição | Meta |
|------|-----------|------|
| Cerveja Grátis | Uma cerveja 600ml cortesia da casa | R$ 300 |
| Desconto 10% | Desconto de 10% na próxima compra | R$ 500 |
| Frete Grátis | Entrega gratuita no próximo pedido | R$ 200 |

---

## 🔧 Após Criar a Tabela

1. **Reload a aplicação** (F5 no navegador)
2. **Acesse a página de Recompensas:** `/recompensas`
3. **Crie sua primeira recompensa!** ✨

---

## 📞 Suporte

Se tiver dúvidas em acessar o Supabase Dashboard:
- URL: `https://app.supabase.com`
- Project ID: `ymffclntmynwfdiarlaw`
