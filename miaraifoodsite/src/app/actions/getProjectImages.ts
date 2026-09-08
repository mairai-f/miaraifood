'use server';

import fs from 'fs';
import path from 'path';

// Map of slugs/keywords → telasdosistema image filenames (new png images)
const TELAS_MAP: Record<string, string> = {
  'pdv-caixa':              'pdvfrentedecaixa.png',
  'pdv':                    'pdvfrentedecaixa.png',
  'caixa':                  'pdvfrentedecaixa.png',
  'fechamento-caixa':       'pdvfrentedecaixa.png',
  'fechamentodecaixa':      'pdvfrentedecaixa.png',
  'saida-caixa':            'pdvfrentedecaixa.png',
  'saidadecaixa':           'pdvfrentedecaixa.png',
  'estoque':                'controleseuestoque.png',
  'controle-estoque':       'controleseuestoque.png',
  'produtos':               'cadastreprodutos.png',
  'cadastro-produtos':      'cadastreprodutos.png',
  'clientes':               'gestaodofiado.png',
  'gestao-clientes':        'gestaodofiado.png',
  'financeiro':             'paineldecontrole.png',
  'financeiro-dre':         'paineldecontrole.png',
  'relatorios':             'paineldecontrole.png',
  'dashboard':              'paineldecontrole.png',
  'nota-fiscal':            'pdvfrentedecaixa.png',
  'notafiscal':             'pdvfrentedecaixa.png',
  'comandas':               'telademesas.png',
  'compras-fornecedores':   'controleseuestoque.png',
  'operacoes':              'configuraçoes.png',
  'precificacao':           'cadastreprodutos.png',
  'colaboradores':          'configuraçoes.png',
  'cadastro-colaboradores': 'configuraçoes.png',
  'acesso-colaboradores':   'configuraçoes.png',
  'buscador-vendas':        'paineldecontrole.png',
  'buscadordevendas':       'paineldecontrole.png',
  'tutorial':               'paineldecontrole.png',
  'ativacao':               'paineldecontrole.png',
  'login':                  'paineldecontrole.png',
  'cadastro':               'cadastreprodutos.png',
  'cardapio':               'cardaioqrcode.png',
  'mesas':                  'telademesas.png',
  'kds':                    'telakdscozinha.png',
  'cozinha':                'telakdscozinha.png',
  'fiado':                  'gestaodofiado.png',
};

export async function getProjectImages(slug: string, title?: string): Promise<string[]> {
    const publicDir = path.join(process.cwd(), 'public');
    const telasDir = path.join(publicDir, 'telasdosistema');

    // 1. Try slug directly in TELAS_MAP
    if (TELAS_MAP[slug]) {
        const filePath = path.join(telasDir, TELAS_MAP[slug]);
        if (fs.existsSync(filePath)) {
            return [`/telasdosistema/${TELAS_MAP[slug]}`];
        }
    }

    // 2. Try to match any keyword in the slug
    const slugLower = slug.toLowerCase();
    for (const [key, file] of Object.entries(TELAS_MAP)) {
        if (slugLower.includes(key) || key.includes(slugLower)) {
            const filePath = path.join(telasDir, file);
            if (fs.existsSync(filePath)) {
                return [`/telasdosistema/${file}`];
            }
        }
    }

    // 3. Try title keywords
    if (title) {
        const titleLower = title.toLowerCase();
        for (const [key, file] of Object.entries(TELAS_MAP)) {
            if (titleLower.includes(key.replace(/-/g, ' ')) || titleLower.includes(key)) {
                const filePath = path.join(telasDir, file);
                if (fs.existsSync(filePath)) {
                    return [`/telasdosistema/${file}`];
                }
            }
        }
    }

    // 4. Fallback: return the dashboard as default if nothing matches
    return ['/telasdosistema/paineldecontrole.png'];
}
