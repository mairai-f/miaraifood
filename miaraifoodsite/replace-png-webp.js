const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('./src', (filePath) => {
    if (/\.(tsx?|jsx?)$/.test(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        // Replace .png with .webp for everything inside /telas/ or just general if it's a known file.
        // Actually, let's just replace all .png with .webp if they are part of a string like "/telas/...png" or just any local image reference that was converted.
        // Since we converted all .png in public/telas/, we can safely replace `.png` with `.webp` for any string matching `/telas/.*\.png`.
        
        const newContent = content.replace(/\/telas\/([a-zA-Z0-9_-]+)\.png/g, '/telas/$1.webp');
        
        // Also check if there are cases like "filename.png" in arrays, like in CertificateHeroScroll.tsx
        // const CERTIFICATE_POOL = [ "acessoscolaboradores.png", ... ]
        // We can replace those too.
        const newContent2 = newContent.replace(/([a-zA-Z0-9_-]+)\.png/g, (match, p1) => {
            // Only replace if it's one of the converted files.
            const convertedFiles = [
                'ativacao', 'acessoscolaboradores', 'buscadordevendas', 'Financeiro',
                'cadastro', 'colaboradores', 'cadastrocolaboradores', 'clientes',
                'dashboard', 'comandas', 'login_desktop', 'fechamentodecaixa',
                'estoque', 'notafiscal', 'operaçoes', 'pdv', 'pdvfinalizandovenda',
                'precificaçao', 'saidadecaixa', 'produtos', 'relatorios', 'tutorialinicial'
            ];
            // Normalize unicode just in case, but simple check works since they match.
            // Actually, we can just replace all \.png in CERTIFICATE_POOL or similar if they match the list.
            if (convertedFiles.includes(p1) || convertedFiles.includes(p1.replace('ç','c'))) {
                 return `${p1}.webp`;
            }
            return match;
        });

        if (content !== newContent2) {
            fs.writeFileSync(filePath, newContent2, 'utf8');
            console.log(`Updated ${filePath}`);
        }
    }
});
