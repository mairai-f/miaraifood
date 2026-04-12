// Pagina de fallback (atualmente nao utilizada pelas rotas principais)

const PlaceholderIndex = () => {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#fcfbf8' }}>
      <img src="/placeholder.svg" alt="Seu app aparecera aqui" />
    </div>
  );
};

const Index = PlaceholderIndex;

export default Index;
