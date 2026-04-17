
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_cliente TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cnpj TEXT,
  nome_estabelecimento TEXT NOT NULL,
  tipo_estabelecimento TEXT NOT NULL,
  cep TEXT NOT NULL,
  endereco TEXT NOT NULL,
  nome_rua TEXT NOT NULL,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  plano TEXT NOT NULL DEFAULT 'demo',
  plano_ativo BOOLEAN NOT NULL DEFAULT true,
  demo_inicio TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own empresa"
  ON public.empresas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own empresa"
  ON public.empresas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own empresa"
  ON public.empresas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
