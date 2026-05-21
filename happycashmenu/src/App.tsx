import { useEffect, useState } from "react";

import { AdminApp } from "@/components/AdminApp";
import { AppSplash } from "@/components/AppSplash";
import { PublicMenu } from "@/components/PublicMenu";
import { fallbackMenu } from "@/data/fallback";
import { hasSeenMenuSplash, markMenuSplashSeen } from "@/lib/appSplash";

type RouteState = {
  mode: "admin" | "public";
  slug: string;
  tableSlug: string | null;
};

const parseRoute = (): RouteState => {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const first = parts[0];

  if (!first || first === "admin" || first === "login") {
    return {
      mode: "admin",
      slug: fallbackMenu.store.slug,
      tableSlug: null,
    };
  }

  const tableIndex = parts.indexOf("mesa");
  return {
    mode: "public",
    slug: first,
    tableSlug: tableIndex >= 0 ? parts[tableIndex + 1] || null : null,
  };
};

function App() {
  const route = parseRoute();
  const [progress, setProgress] = useState(() => (hasSeenMenuSplash() ? 100 : 0));
  const [showSplash, setShowSplash] = useState(() => !hasSeenMenuSplash());

  useEffect(() => {
    if (hasSeenMenuSplash()) return undefined;

    const stepValues = [24, 52, 78, 100];
    const timerIds = stepValues.map((stepValue, index) =>
      window.setTimeout(() => setProgress(stepValue), (index + 1) * 320),
    );
    const doneTimer = window.setTimeout(() => {
      markMenuSplashSeen();
      setShowSplash(false);
    }, 1520);

    return () => {
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
      window.clearTimeout(doneTimer);
    };
  }, []);

  if (showSplash) {
    return (
      <AppSplash
        progress={progress}
        title="HappyCashMenu"
        subtitle="Cardapio digital | QR mesa | delivery"
      />
    );
  }

  if (route.mode === "admin") {
    return <AdminApp />;
  }

  return <PublicMenu slug={route.slug} tableSlug={route.tableSlug} />;
}

export default App;
