import { useEffect } from 'react';
import { ExternalLink, Loader2, Utensils } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const buildFoodSystemUrl = () => {
  const configuredUrl = import.meta.env.VITE_HAPPYCASH_FOOD_APP_URL || 'https://food.happycashsite.com.br/';
  const url = new URL(configuredUrl, typeof window === 'undefined' ? 'https://app.happycashsite.com.br' : window.location.origin);
  url.searchParams.set('site_access', '1');
  return url.toString();
};

const foodSystemUrl = buildFoodSystemUrl();

export default function RestaurantRedirect() {
  useEffect(() => {
    window.location.assign(foodSystemUrl);
  }, []);

  return (
    <div className="flex min-h-[65vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg border-border/70">
        <CardContent className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Utensils className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Abrindo HappyCashFood</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sua conta ja foi validada pelo HappyCash. O sistema restaurante sera aberto em instantes.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecionando...
          </div>
          <Button asChild className="w-full font-semibold">
            <a href={foodSystemUrl}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir agora
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
