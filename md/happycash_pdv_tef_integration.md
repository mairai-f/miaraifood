# Diagrama de Integração PDV ↔ TEF (HappyCash)

## Visão geral
Este diagrama mostra como o módulo **PDV** do HappyCash se comunica com um **Sistema TEF** (Transferência Eletrônica de Fundos) para autorizar e capturar pagamentos de cartões.

### Componentes
- **PDV Frontend (React)** – interface de caixa onde o operador registra a venda.
- **PDV Backend (Node/Electron)** – lógica de negócio do PDV, responsável por iniciar a transação e receber callbacks.
- **TEF Adapter** – middleware que encapsula a API do provedor TEF (REST/HTTPS). Converte pedidos do PDV para o formato exigido pelo provedor.
- **API TEF Provider** – gateway externo do provedor de pagamento (ex.: Cielo, Stone, Rede).
- **Banco/Emissor** – entidade que valida e captura o pagamento.
- **AuthContext / Supabase** – camada de autenticação/autorização que garante que o PDV só envie transações autenticadas.

### Fluxo de dados (simplificado)
1. **Operador** confirma a venda no **PDV Frontend**.
2. O **Frontend** chama o **Backend** via IPC (Electron) enviando os detalhes da venda.
3. O **Backend** solicita um token ao **AuthContext** (Supabase) para garantir autorização.
4. O **Backend** invoca o **TEF Adapter**, que faz uma requisição HTTPS `POST /auth` ao **API TEF Provider**.
5. O **Provider** responde com um **ID da transação** e um **status pendente**.
6. O **Adapter** envia o **ID** de volta ao **Backend**, que notifica o **Frontend** (status “Aguardando aprovação”).
7. O **Cliente** insere o cartão; o **Provider** realiza a **autorização** com o **Banco/Emissor**.
8. O **Provider** devolve o resultado (`APPROVED`/`DECLINED`).
9. O **Adapter** propaga o resultado ao **Backend**, que atualiza o registro da venda e dispara um evento de **captura** se aprovado.
10. O **Backend** grava o **receipt** e o **status** no banco via **Supabase**.

### Comunicação
- **IPC (Electron)** – entre Frontend e Backend.
- **HTTPS (REST)** – entre TEF Adapter e API TEF Provider.
- **WebSocket (opcional)** – para callbacks assíncronos de status de transação.

---

![Diagrama de Integração PDV ↔ TEF](/home/celio/.gemini/antigravity/brain/d03d9d85-ef02-40a8-ac5e-0bc1d5b01576/happycash_pdv_tef_integration_1787062350198.png)

> **Descrição** – O diagrama ilustra os componentes acima e o fluxo de autorização, captura e confirmação de pagamento.
