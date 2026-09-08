const fs = require('fs');
const file = '/home/celio/Miaraifood/miaraifoodsite/src/data/portfolio.ts';
let data = fs.readFileSync(file, 'utf8');

const map = {
  '/telas/pdvfinalizandovenda.webp': '/telasdosistema/pdvfrentedecaixa.png',
  '/telas/clientes.webp': '/telasdosistema/gestaodofiado.png',
  '/telas/estoque.webp': '/telasdosistema/controleseuestoque.png',
  '/telas/relatorios.webp': '/telasdosistema/paineldecontrole.png',
  '/telas/Financeiro.webp': '/telasdosistema/paineldecontrole.png',
  '/telas/produtos.webp': '/telasdosistema/cadastreprodutos.png',
  '/telas/operaçoes.webp': '/telasdosistema/configuraçoes.png',
  '/telas/fechamentodecaixa.webp': '/telasdosistema/pdvfrentedecaixa.png',
  '/telas/cadastro.webp': '/telasdosistema/cadastreprodutos.png',
  '/telas/dashboard.webp': '/telasdosistema/paineldecontrole.png',
  '/telas/ativacao.webp': '/telasdosistema/paineldecontrole.png',
  '/telas/login_desktop.webp': '/telasdosistema/paineldecontrole.png',
  '/telas/buscadordevendas.webp': '/telasdosistema/paineldecontrole.png',
  '/telas/precificaçao.webp': '/telasdosistema/cadastreprodutos.png',
  '/telas/pdv.webp': '/telasdosistema/pdvfrentedecaixa.png',
  '/telas/tutorialinicial.webp': '/telasdosistema/paineldecontrole.png',
  '/telas/notafiscal.webp': '/telasdosistema/pdvfrentedecaixa.png',
  '/telas/comandas.webp': '/telasdosistema/telademesas.png'
};

for (const [oldPath, newPath] of Object.entries(map)) {
  data = data.split(oldPath).join(newPath);
}

fs.writeFileSync(file, data, 'utf8');
