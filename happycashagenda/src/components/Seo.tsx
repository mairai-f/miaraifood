import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAgendaBranding } from "@/hooks/useAgendaBranding";

type SeoConfig = {
  title: string;
  description: string;
};

const DEFAULT_SEO: SeoConfig = {
  title: "HappyCash Agenda | Agendamento Online",
  description:
    "Agende serviços online, escolha profissional, horario e acompanhe tudo pelo HappyCash Agenda.",
};

const ROUTE_SEO: Record<string, SeoConfig> = {
  "/": {
    title: "HappyCash Agenda | Agenda online para serviços",
    description:
      "Sistema de agendamentos para empresas de servicos com clientes, profissionais, pagamentos e WhatsApp.",
  },
  "/auth": {
    title: "Entrar | HappyCash Agenda",
    description:
      "Acesse sua conta HappyCash Agenda para agendar horarios e gerenciar atendimentos.",
  },
  "/booking": {
    title: "Agendar horário | HappyCash Agenda",
    description:
      "Agende seu horario: selecione servico, profissional, data e horario disponiveis.",
  },
  "/my-appointments": {
    title: "Meus agendamentos | HappyCash Agenda",
    description:
      "Veja e gerencie seus agendamentos. Consulte proximos horarios e historico.",
  },
  "/admin": {
    title: "Dashboard do administrador | HappyCash Agenda",
    description:
      "Painel administrativo para gerenciar profissionais, servicos, clientes e agendamentos.",
  },
};

function upsertMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertProperty(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="canonical"]`);
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

export default function Seo() {
  const location = useLocation();
  const { settings } = useAgendaBranding();

  useEffect(() => {
    const config = ROUTE_SEO[location.pathname] ?? DEFAULT_SEO;
    const title = config.title.replace("HappyCash Agenda", settings.displayName);
    const description = config.description.replace("HappyCash Agenda", settings.displayName);

    document.title = title;
    upsertMeta("description", description);

    const canonical = `${window.location.origin}${location.pathname}`;
    upsertCanonical(canonical);
    upsertProperty("og:url", canonical);
    upsertProperty("og:title", title);
    upsertProperty("og:description", description);
  }, [location.pathname, settings.displayName]);

  return null;
}
