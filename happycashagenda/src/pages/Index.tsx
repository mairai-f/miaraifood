import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { slugFromPathname } from '@/lib/agendaSlug';

const isMobileViewport = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
};

export default function Index() {
  const [splashDone, setSplashDone] = useState(() => {
    return !!sessionStorage.getItem('happycash_agenda_visited');
  });
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const navigate = useNavigate();
  const location = useLocation();
  const mobileLoginPath = useMemo(() => {
    const slug = slugFromPathname(location.pathname);
    return `${slug ? `/${slug}` : ''}/login${location.search}`;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const updateMobile = () => setIsMobile(media.matches);

    updateMobile();
    media.addEventListener('change', updateMobile);
    return () => media.removeEventListener('change', updateMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    sessionStorage.setItem('happycash_agenda_visited', 'true');
    navigate(mobileLoginPath, { replace: true });
  }, [isMobile, mobileLoginPath, navigate]);

  const handleSplashComplete = () => {
    setSplashDone(true);
    navigate(`/login${location.search}`);
  };

  if (isMobile) {
    return null;
  }

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
