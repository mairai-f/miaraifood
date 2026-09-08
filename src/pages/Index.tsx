// Pagina de fallback (atualmente nao utilizada pelas rotas principais)

import miarLogo from "@/assets/miar-logo.svg";

const PlaceholderIndex = () => {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#fcfbf8' }}>
      <img src={miarLogo} alt="MIAR AI/FOOD" className="w-full max-w-xs object-contain" />
    </div>
  );
};

const Index = PlaceholderIndex;

export default Index;
