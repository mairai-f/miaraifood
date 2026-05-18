import { AdminApp } from "@/components/AdminApp";
import { PublicMenu } from "@/components/PublicMenu";
import { fallbackMenu } from "@/data/fallback";

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
      mode: first ? "admin" : "public",
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

  if (route.mode === "admin") {
    return <AdminApp />;
  }

  return <PublicMenu slug={route.slug} tableSlug={route.tableSlug} />;
}

export default App;
