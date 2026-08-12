import re

file_path = "/home/celio/Documentos/happycashsite/src/data/portfolio.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the achievements array and replace it
# It starts at "  achievements: [" and ends before "  techStack: ["
pattern = r"  achievements:\s*\[.*?\](?=,\n\s*techStack:\s*\[)"

new_achievements = """  achievements: [
    {
      id: "help-1",
      title: "Como cadastrar um produto",
      issuer: "Suporte",
      date: "2026-08-01",
      description: "Aprenda como cadastrar produtos, definir preços e organizar as informações necessárias para suas vendas.",
      category: "Estoque",
      type: "Tutorial",
      image: "/telas/produtos.png"
    },
    {
      id: "help-2",
      title: "Como realizar uma venda no PDV",
      issuer: "Suporte",
      date: "2026-08-01",
      description: "Veja como localizar produtos, adicionar itens à venda, selecionar o pagamento e finalizar uma operação.",
      category: "PDV",
      type: "Tutorial",
      image: "/telas/pdv.png"
    },
    {
      id: "help-3",
      title: "Como controlar vendas no Fiado",
      issuer: "Suporte",
      date: "2026-08-01",
      description: "Entenda como registrar vendas a prazo e acompanhar os valores pendentes dos clientes.",
      category: "Clientes e Fiado",
      type: "Tutorial",
      image: "/telas/clientes.png"
    },
    {
      id: "help-4",
      title: "Como consultar o estoque",
      issuer: "Suporte",
      date: "2026-08-01",
      description: "Acompanhe produtos, movimentações e informações disponíveis sobre o estoque.",
      category: "Estoque",
      type: "Tutorial",
      image: "/telas/estoque.png"
    },
    {
      id: "help-5",
      title: "Como fechar o caixa",
      issuer: "Suporte",
      date: "2026-08-01",
      description: "Confira os procedimentos necessários para realizar o fechamento da operação do caixa.",
      category: "Financeiro",
      type: "Tutorial",
      image: "/telas/fechamentodecaixa.png"
    },
    {
      id: "help-6",
      title: "Primeiros passos no sistema",
      issuer: "Suporte",
      date: "2026-08-01",
      description: "Um guia rápido para você configurar os dados iniciais do seu sistema HappyCash.",
      category: "Começando no HappyCash",
      type: "Guia",
      image: "/telas/tutorialinicial.png"
    },
    {
      id: "help-7",
      title: "Ajustando Configurações Gerais",
      issuer: "Suporte",
      date: "2026-08-01",
      description: "Como alterar senhas, nome da loja e configurações de impressão.",
      category: "Configurações",
      type: "Manual",
      image: "/telas/acessoscolaboradores.png"
    }
  ]"""

new_content = re.sub(pattern, new_achievements, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Achievements replaced successfully!")
