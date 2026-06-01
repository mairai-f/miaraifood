import { useEffect, useState } from 'react';
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
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { useAuth } from '@/hooks/useAuth';
import { buildAgendaPublicHomePath } from '@/lib/agendaPublicLink';
import { resolveAgendaRequestedSlug } from '@/lib/agendaSlug';

export default function Index() {
  const { user, isAdmin } = useAuth();
  const { settings } = useAgendaBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [splashDone, setSplashDone] = useState(() => {
    return !!sessionStorage.getItem('happycash_agenda_visited');
  });

  useEffect(() => {
    if (
      location.pathname !== '/'
      || resolveAgendaRequestedSlug(location.pathname, location.search)
      || !user
      || !isAdmin
      || !settings.storeAccountId
    ) {
      return;
    }

    navigate(buildAgendaPublicHomePath(settings.slug), { replace: true });
  }, [
    isAdmin,
    location.pathname,
    location.search,
    navigate,
    settings.slug,
    settings.storeAccountId,
    user,
  ]);

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
