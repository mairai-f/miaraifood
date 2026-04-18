import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(currentFile);
const rootDir = path.resolve(scriptsDir, '..');
const distDir = path.join(rootDir, 'dist');
const cordovaWwwDir = path.join(rootDir, 'mobile', 'www');
const indexPath = path.join(cordovaWwwDir, 'index.html');
const gitkeepPath = path.join(cordovaWwwDir, '.gitkeep');

if (!existsSync(distDir)) {
  throw new Error('A pasta dist nao existe. Rode "npm run build" antes de sincronizar o Cordova.');
}

mkdirSync(cordovaWwwDir, { recursive: true });

for (const entry of readdirSync(cordovaWwwDir)) {
  rmSync(path.join(cordovaWwwDir, entry), { recursive: true, force: true });
}

cpSync(distDir, cordovaWwwDir, { recursive: true });

const indexHtml = readFileSync(indexPath, 'utf8');
const cordovaIndexHtml = indexHtml.includes('cordova.js')
  ? indexHtml
  : indexHtml.replace(
      '<script type="module"',
      '<script src="cordova.js"></script>\n    <script type="module"',
    );

writeFileSync(indexPath, cordovaIndexHtml, 'utf8');
writeFileSync(gitkeepPath, '', 'utf8');

console.log(`Build web sincronizado em ${path.relative(rootDir, cordovaWwwDir)}.`);
