const fs = require('fs');

function replaceInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace "/paginainicial#planos" -> "/planos"
    content = content.replace(/\/paginainicial#planos/g, '/planos');
    // Replace "/paginainicial" -> "/"
    content = content.replace(/\/paginainicial/g, '/');
    fs.writeFileSync(filePath, content, 'utf8');
}

replaceInFile('/home/celio/Documentos/happycashsite/src/app/(dashboard)/dashboard/page.tsx');
replaceInFile('/home/celio/Documentos/happycashsite/src/app/(auth)/login/page.tsx');
replaceInFile('/home/celio/Documentos/happycashsite/src/app/(auth)/cadastro/page.tsx');

console.log('Fixed /paginainicial links');
