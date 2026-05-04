criar anuncios para o sistema web e os executaveis,menos no mobile para o administrador e operador popups suaves que aparece vendendo divulgando  pacotes de menssagens para envios automaticos|
2*Fase 2:
- API da Meta (1 número seu)
Fase 3:
- Multi-tenant (cada cliente com número próprio)
Cliente cadastra WhatsApp
↓
happycashsite conecta na Meta
↓
Salva token no banco
↓
HappyCash envia usando o número dele
criar anuncios para o sistema web e os executaveis,menos no mobile para o administrador e operador popups suaves que aparece vendendo divulgando  pacotes de menssagens para envios automaticos|
2*Fase 2:
- API da Meta (1 número seu)
Fase 3:
- Multi-tenant (cada cliente com número próprio)
Cliente cadastra WhatsApp
↓
happycashsite conecta na Meta
↓
Importante: não salve o PIN puro. Salve hash:

PIN digitado → gera hash → compara com hash salvo
Fluxo completo para o cliente
1. Cliente compra no happycashsite.com.br
2. Pagamento aprovado no Asaas
3. Sistema gera licença PRO Offline
4. Cliente recebe e-mail/WhatsApp com:
   - link do executável
   - chave de ativação
5. Cliente instala
6. Ativa uma vez com internet
7. Cria usuário/PIN local
8. Usa 100% offline
9. Quando quiser, clica em "Sincronizar"
Sobre impressora

Você pode colocar no onboarding do desktop:

Configurar impressora
↓
Escolher impressora instalada
↓
Testar impressão
↓
Salvar como padrão

Como você não vende maquininha, no site deixe claro:

Compatível com impressoras térmicas instaladas no computador.
A impressora não está inclusa no plano.
Regra de licença offline

Para evitar uso sem pagar, faça assim:

Licença válida até: 30 dias
Tolerância offline: 7 dias

Exemplo:

Cliente pagou mensalidade
↓
Executável renova licença quando tiver internet
↓
Se ficar offline, continua funcionando por X dias
↓
Depois pede reconexão para validar
Minha recomendação final

Para o HappyCash PRO Offline, use:

Cadastro e pagamento no site
Ativação inicial online
Uso diário com usuário + PIN
Banco local SQLite
Licença local criptografada
Sincronização manual/automática
Use SQLite:

SQLite local
- empresa
- usuarios_locais
- produtos
- clientes
- vendas
- contas_fiado
- estoque
- fila_sync
- licenca

1. Cliente plano pro baixa o instalador
2. Instala normalmente (sem licença)
3. Abre o sistema pela primeira vez
4. Tela de ativação aparece
5. Cliente insere:
   - chave de licença
   - usuário + PIN (ou cria ali)
   para ja ficar salvo nos dados local do offline 
6. Sistema valida online 1x
7. Salva licença local
8. Libera uso offline
Banco local:
- produtos
- clientes
- vendas
- itens_venda
- estoque
- operadores
- permissoes
- fila_sync
- licenca
Ativa licença uma vez

Cria admin local

Admin cria operadores de caixa

Todos usam offline

Dados ficam no SQLite
↓
Quando tiver internet, sincroniza com Supabase

Dia 1 → ativou plano
Plano é “30 dias de acesso”
↓
Dia 30 → plano vence
↓
Dia 30  → funciona offline (7 tolerância)
↓
Dia 38 → bloqueio parcial
↓
Reconecta internet → valida pagamento → libera
Plano Básico
R$ 100 / 30 dias
R$ 997 / ano

Plano Completo
R$ 230 / 30 dias
R$ 2.097 / ano

Plano PRO
R$ 347 / 30 dias
R$ 2.997 / ano

Plano PRO: R$347 / 30 dias
Offline permitido: até 7 dias
Renovação da licença: automática quando tiver internet ajuste isso na landing page tambem na parte do ressaltar os novos adicionis do sistema ao xml,seo avançado convincente de texto,logico que o sistema offline nao envia menssagem para o whatsapp e quando tentar marcar abrir modal para avisa reconecte-se para marcar e o modal,o apk 

# HappyCash — Planos, Licença Offline, WhatsApp e Anúncios Internos

## 1. Objetivo

Adicionar anúncios suaves dentro do sistema web e executável desktop para divulgar pacotes extras de mensagens automáticas via WhatsApp.

Esses anúncios devem aparecer apenas para:

- Administrador
- Operador

Não exibir no aplicativo mobile/APK.

---

## 2. Onde exibir os anúncios

### Sistema Web
Exibir anúncios somente quando o sistema estiver online.

7. Sistema offline não envia WhatsApp

Quando o sistema estiver offline, ele não deve tentar enviar mensagens.

Se o usuário tentar marcar cobrança automática ou envio por WhatsApp offline, exibir modal:

Conexão necessária

Para enviar ou agendar mensagens automáticas pelo WhatsApp, reconecte o sistema à internet.

O modo offline continua funcionando para vendas, clientes, estoque e fiado, mas os envios automáticos precisam de conexão.

Botão:

Entendi

# Fluxo completo do cliente PRO Offline
1. Cliente compra no happycashsite.com.br
2. Pagamento aprovado no Asaas
3. Sistema gera licença PRO Offline
executavel fica disponivel no site apenas apos registrar pagamento
 Cliente instala o executável
6. Ativa uma vez com internet
7. Cria usuário administrador e PIN local
8. Usa o sistema offline
9. Quando tiver internet, clica em "Sincronizar"
9. Segurança do PIN

Nunca salvar o PIN puro no banco.

Fluxo correto:

PIN digitado
↓
Gera hash
↓
Compara com hash salvo
Dia 1 → ativou o plano
Dia 30 → plano vence
Dia 31 até Dia 33 → tolerância offline
lembrar de avisar sempre que falta 2 dias para o plano esgotar pode ser com popups suaves dar desconto para o plano pro para pagar com 15 dias de antecedencia ganhndo desconto de 25 reais 
Dia 38 → bloqueio total
Reconectou internet → valida pagamento → libera novamente
Licença precisa ser renovada

Seu período offline expirou. Conecte-se à internet para validar sua assinatura e continuar usando todos os recursos do HappyCash PRO.
deixar claro que 
13. Impressora térmica

No onboarding do desktop:

Configurar impressora
↓
Escolher impressora instalada
↓
Testar impressão
↓
Salvar como padrão

Texto no site:

Compatível com impressoras térmicas instaladas no computador.
A impressora não está inclusa no plano.
documente tudo isso com #apontando que cada coisa faz essas linhas de codigo,migrations quero tudo documentado 
