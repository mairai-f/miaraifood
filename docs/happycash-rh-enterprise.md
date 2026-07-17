# HappyCash RH Enterprise

Produto completo de RH e departamento pessoal para vender como solução própria.

## Decisão de produto

- Nome comercial: `HappyCash RH Enterprise`.
- Banco dedicado do RH: `happycashrh/supabase`.
- App separado: `happycashrh`.
- Site público: `/happycash-rh-enterprise`.
- Salário, documentos, dados médicos, folha e eventos legais ficam em ambiente dedicado de RH.

## Módulos do produto completo

1. Cadastro de empresas, unidades, setores e cargos.
2. Cadastro completo de colaboradores.
3. Admissão digital.
4. Recrutamento e seleção.
5. Controle de ponto, banco de horas e espelho.
6. Escalas por dia, turno, unidade e setor.
7. Férias, folgas, licenças, atestados e afastamentos.
8. Benefícios.
9. Folha de pagamento.
10. Holerites.
11. eSocial.
12. Obrigações acessórias: RAIS, DIRF, CAGED e informe de rendimentos.
13. SST: PGR, PCMSO, ASO, EPI, CIPA e CAT.
14. Rescisão contratual/TRCT.
15. 13º salário.
16. Recrutamento, banco de candidatos e caça-talentos.
17. Avaliação de desempenho, metas, PDI e feedback 360.
18. Treinamentos, turmas, certificados e trilhas.
19. Comunicação interna, pesquisas de clima, ouvidoria e eventos.
20. Portal do colaborador.
21. Portal do gestor.
22. Tabela cruzada inteligente.
23. Gerador de relatórios personalizados.
24. Chat IA para apoio ao RH, DP e auditoria.
25. Menu personalizável.
26. Relatórios e indicadores.
27. LGPD, retenção, auditoria e consentimentos.
28. Segurança Enterprise, permissões, sessões, integrações, backups e API.

## Ordem de codagem

1. Fundação do banco: empresas, usuários, permissões, colaboradores, cargos e unidades.
2. App/splash/painel inicial do RH.
3. Lista de colaboradores e pasta do colaborador.
4. Cadastro/edição completo com foto, endereço, documentos e dados contratuais.
5. Ponto e escalas.
6. Férias, afastamentos e documentos.
7. Folha, eventos, holerites e conferência.
8. eSocial com XML, lote, protocolo, recibo, rejeição e retificação.
9. Obrigações acessórias, SST, rescisão e 13º salário.
10. Portais do colaborador/gestor, relatórios e auditoria avançada.
11. IA, tabela cruzada, integrações e menu personalizável.

## Regra para folha e eSocial

Folha e eSocial devem ser implementados com regras versionadas por competência. Nada de cálculo solto sem versão legal, trilha de auditoria e conferência. Cada fechamento precisa guardar entrada, cálculo, aprovação, holerite, eventos gerados, recibos e retificações.

## Referências oficiais usadas como norte

- eSocial: documentação técnica, Manual de Orientação, leiautes, tabelas e XSD da versão S-1.3.
- Registro eletrônico de ponto: Portaria MTP 671/2021, perguntas e respostas REP, arquivos AFD/AEJ e exigência de auditoria.
- FGTS: depósito mensal padrão de 8% para contrato CLT, com exceções como aprendiz.
- LGPD: Lei 13.709/2018, com controle de acesso, registro de tratamento, dados sensíveis, correção, exportação, retenção e anonimização.

## Migrations do banco dedicado

- `happycashrh/supabase/migrations/20260716233000_happycash_rh_enterprise_foundation.sql`: tenant, membros, unidades, cargos, colaboradores, documentos, escalas, ponto, ausências, benefícios, folha, holerite, eSocial e auditoria.
- `happycashrh/supabase/migrations/20260716234500_happycash_rh_enterprise_advanced_modules.sql`: recrutamento, candidatos, treinamentos, desempenho, SST, obrigações acessórias, documentos inteligentes, comunicados, relatórios, IA, menu e preferências.
- `happycashrh/supabase/migrations/20260717001000_happycash_rh_enterprise_compliance_portals.sql`: rubricas legais, versões de regras, admissão digital, portal do colaborador, portal do gestor, solicitações LGPD, retenção, arquivos bancários e conectores.

## Holerite empresarial

O demonstrativo precisa trazer, no mínimo:

- Identificação do empregador: razão social, CNPJ e endereço.
- Identificação do empregado: nome, CPF, matrícula, cargo, CBO, admissão, contrato, setor, unidade e dados bancários.
- Competência e data de pagamento.
- Rubricas com código, descrição, referência, proventos e descontos.
- Total de proventos, total de descontos e líquido.
- Bases de INSS, FGTS e IRRF, além do valor de FGTS do mês quando aplicável.
- Hash/recibo de auditoria, status, assinatura/ciência e histórico de liberação.
