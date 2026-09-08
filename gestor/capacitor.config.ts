import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.miarai.food.gestor',
  appName: 'MIAR Gestor Estabelecimento',
  webDir: 'dist/public',
  server: { androidScheme: 'https' },
};

export default config;
