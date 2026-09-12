// Logos importadas como assets do Vite, nao por caminho absoluto.
//
// No app desktop a interface roda em file://, entao "/miar-logo.svg" aponta
// para a raiz do sistema de arquivos e a imagem quebra. Importado, o bundler
// resolve o caminho relativo certo na web e no executavel.
import miarCollapsedIcon from '@/assets/brand/miar-collapsed-icon.svg';
import miarCollapsedIconWhite from '@/assets/brand/miar-collapsed-icon-white.svg';
import miarLogo from '@/assets/brand/miar-logo.svg';
import miarLogoWhite from '@/assets/brand/miar-logo-white.svg';

export { miarCollapsedIcon, miarCollapsedIconWhite, miarLogo, miarLogoWhite };
