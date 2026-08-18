# Contexto e Linguagem Compartilhada (HappyCash ERP)

Este documento define o vocabulário oficial (Ubiquitous Language) do projeto HappyCash, garantindo alinhamento total entre o desenvolvedor (IA) e o domínio de negócio. 

## Dicionário de Negócio (Domain Language)
*   **HappyCash**: O nome oficial do nosso sistema de ERP focado em pequenos varejos e mercadinhos.
*   **PDV (Ponto de Venda)**: A tela de Caixa (Frente de Loja). Otimizada para teclado, velocidade extrema e scanners de código de barras.
*   **Caderneta Digital (Fiado)**: O grande diferencial do HappyCash. É o sistema que registra dívidas dos clientes da loja. Em outros ERPs chama-se "Contas a Receber", aqui é tratado com foco cultural na confiança do varejo local.
*   **Comanda (Service Ticket)**: Compras em aberto que ainda não foram pagas no caixa (ex: cliente consumindo na padaria antes de pagar).
*   **Operador (Caixa)**: Usuário com permissões limitadas. Só pode vender e abrir/fechar o próprio turno de caixa.
*   **Administrador (Dono)**: Usuário master. Tem permissão de alterar preços, limpar fiados, e usar Passkeys (Biometria/Windows Hello) para aprovar exceções no PDV.
*   **Transação Atômica**: Função no Supabase (RPC) que garante que a venda e a baixa de estoque ocorram no mesmo milissegundo, bloqueando concorrência (vendas duplicadas).
*   **Fila Offline (Concentrador)**: Mecanismo de resiliência. Quando não há internet, o sistema joga vendas para uma fila local (Local Storage/IndexedDB) e sincroniza automaticamente com o Supabase quando a conexão volta.
*   **Módulo Fiscal**: A futura emissão de NFC-e (Cupom Fiscal Eletrônico) que será feita conectando nosso backend a um Gateway Fiscal externo, usando certificado A1 do cliente. Atualmente tratada de forma passiva.

## Princípios de Arquitetura
1.  **Velocidade Importa Mais que Tudo**: No PDV, não usamos "Toasts" bloqueantes nem pop-ups inúteis. A fila precisa andar.
2.  **Segurança Master**: Qualquer ação destrutiva (apagar venda, mudar preço) exige validação master (Senha ou Passkey).
3.  **UI Premium Institucional**: O site de vendas (Next.js) deve usar *Glassmorphism*, cores sofisticadas e animações responsivas que rodem perfeitamente no Mobile sem engasgos (Scrubbing pesado no celular é proibido).
4.  **Menos é Mais**: Não competimos com o TOTVS. Não precisamos de mil telas. Foco no básico, mas perfeito.
