import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SplashScreen } from '@/components/SplashScreen';
import { HeroSection } from '@/components/landing/HeroSection';
import { BarberGallery } from '@/components/landing/BarberGallery';
import { AboutSection } from '@/components/landing/AboutSection';
import { LocationSection } from '@/components/landing/LocationSection';
import { FooterSection } from '@/components/landing/FooterSection';
import { SectionNav } from '@/components/landing/SectionNav';
import { SwipeSections } from '@/components/landing/SwipeSections';

export default function Index() {
  const [splashDone, setSplashDone] = useState(() => {
    return !!sessionStorage.getItem('happycash_agenda_visited');
  });
  const navigate = useNavigate();
  const location = useLocation();

  const handleSplashComplete = () => {
    setSplashDone(true);
    navigate(`/login${location.search}`);
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
    </Layout>
  );
}
