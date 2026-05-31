import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SplashScreen } from '@/components/SplashScreen';
import { HeroSection } from '@/components/landing/HeroSection';
import { BarberGallery } from '@/components/landing/BarberGallery';
import { AboutSection } from '@/components/landing/AboutSection';
import { LocationSection } from '@/components/landing/LocationSection';
import { FooterSection } from '@/components/landing/FooterSection';
import { PublicPageInlineEditor } from '@/components/landing/PublicPageInlineEditor';
import { SectionNav } from '@/components/landing/SectionNav';
import { SwipeSections } from '@/components/landing/SwipeSections';

export default function Index() {
  const [splashDone, setSplashDone] = useState(() => {
    return !!sessionStorage.getItem('happycash_agenda_visited');
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem('happycash_agenda_visited', 'true');
    setSplashDone(true);
  };

  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <Layout>
      <SectionNav />
      <HeroSection />
      <SwipeSections>
        <div id="equipe"><BarberGallery /></div>
        <div id="sobre"><AboutSection /></div>
        <div id="localizacao"><LocationSection /></div>
      </SwipeSections>
      <FooterSection />
      <PublicPageInlineEditor />
    </Layout>
  );
}
