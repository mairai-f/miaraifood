import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MapPin, Phone, Navigation } from "lucide-react";
import { useBusinessLocations } from "@/hooks/useBusinessLocations";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { useAgendaBranding } from "@/hooks/useAgendaBranding";
import { Skeleton } from "@/components/ui/skeleton";
import toolsImage from "@/assets/barber-tools.jpg";

gsap.registerPlugin(ScrollTrigger);

const normalizeEmbedUrl = (raw: string) => {
  const trimmed = raw.trim();
  const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) return iframeMatch[1];
  const noTags = trimmed.replace(/<[^>]+>/g, "").trim();
  return noTags.replace(/^['"]|['"]$/g, "");
};

export function LocationSection() {
  const { locations, loading: locLoading } = useBusinessLocations();
  const { businessHours, loading: hoursLoading } = useBusinessHours();
  const { settings } = useAgendaBranding();
  const sectionRef = useRef<HTMLElement>(null);

  const DAY_NAMES = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];

  const getFormattedHours = () => {
    if (!businessHours.length) return [];
    const weekdays = businessHours.filter(
      (h) => h.day_of_week >= 1 && h.day_of_week <= 5,
    );
    const saturday = businessHours.find((h) => h.day_of_week === 6);
    const sunday = businessHours.find((h) => h.day_of_week === 0);
    const result: { label: string; hours: string }[] = [];

    if (weekdays.length > 0) {
      const allSame = weekdays.every(
        (w) =>
          w.open_time === weekdays[0].open_time &&
          w.close_time === weekdays[0].close_time &&
          w.is_open === weekdays[0].is_open,
      );
      if (allSame && weekdays[0].is_open) {
        result.push({
          label: "Seg - Sex",
          hours: `${weekdays[0].open_time.slice(0, 5)} - ${weekdays[0].close_time.slice(0, 5)}`,
        });
      } else {
        weekdays.forEach((w) => {
          result.push({
            label: DAY_NAMES[w.day_of_week],
            hours: w.is_open
              ? `${w.open_time.slice(0, 5)} - ${w.close_time.slice(0, 5)}`
              : "Fechado",
          });
        });
      }
    }
    if (saturday)
      result.push({
        label: "Sábado",
        hours: saturday.is_open
          ? `${saturday.open_time.slice(0, 5)} - ${saturday.close_time.slice(0, 5)}`
          : "Fechado",
      });
    if (sunday)
      result.push({
        label: "Domingo",
        hours: sunday.is_open
          ? `${sunday.open_time.slice(0, 5)} - ${sunday.close_time.slice(0, 5)}`
          : "Fechado",
      });
    return result;
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".location-heading",
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 75%" },
        },
      );

      gsap.fromTo(
        ".location-content > *",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: { trigger: ".location-content", start: "top 80%" },
        },
      );

      gsap.fromTo(
        ".location-map",
        {
          opacity: 0,
          scale: 0.95,
          clipPath: "inset(10% 10% 10% 10% round 1rem)",
        },
        {
          opacity: 1,
          scale: 1,
          clipPath: "inset(0% 0% 0% 0% round 1rem)",
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: ".location-map", start: "top 80%" },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const loading = locLoading || hoursLoading;

  return (
    <section ref={sectionRef} className="py-16 md:py-28">
      <div className="container mx-auto px-4">
        <div className="location-heading text-center mb-10 md:mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Navigation className="w-4 h-4" />
            Localização
          </span>
          <h2 className="font-serif text-2xl md:text-5xl font-bold mt-2">
            Onde Estamos
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-start">
          <div className="location-content space-y-6 md:space-y-8">
            <div className="space-y-4">
              <h3 className="font-serif text-lg md:text-xl font-semibold">
                {locations.length > 1 ? "Nossos Endereços" : "Nosso Endereço"}
              </h3>
              {loading ? (
                <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : locations.length > 0 ? (
                locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="p-4 md:p-5 rounded-2xl bg-card border border-border space-y-2"
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 md:w-5 md:h-5 mt-0.5 shrink-0 text-primary" />
                      <div className="text-sm md:text-base">
                        {locations.length > 1 && (
                          <span className="font-medium text-foreground">
                            {loc.name}:{" "}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {loc.address}
                        </span>
                      </div>
                    </div>
                    {loc.phone && (
                      <div className="flex items-center gap-3 ml-7 md:ml-8">
                        <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {loc.phone}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 md:p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground text-sm">
                      Endereço de atendimento não cadastrado
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-serif text-lg md:text-xl font-semibold">
                Horário de Funcionamento
              </h3>
              <div className="p-4 md:p-5 rounded-2xl bg-card border border-border">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2.5 md:space-y-3 text-xs md:text-sm">
                    {getFormattedHours().length > 0 ? (
                      getFormattedHours().map((item, i) => (
                        <li key={i} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {item.label}
                          </span>
                          <span
                            className={
                              item.hours === "Fechado"
                                ? "text-destructive font-medium"
                                : "font-medium"
                            }
                          >
                            {item.hours}
                          </span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">
                            Seg - Sex
                          </span>
                          <span className="font-medium">09:00 - 19:30</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Sábado</span>
                          <span className="font-medium">09:00 - 19:30</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-muted-foreground">Domingo</span>
                          <span className="text-destructive font-medium">
                            Fechado
                          </span>
                        </li>
                      </>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="location-map">
            {locations.length > 0 && locations[0].google_maps_embed_url ? (
              <div className="rounded-2xl overflow-hidden shadow-xl border border-border">
                <iframe
                  src={normalizeEmbedUrl(locations[0].google_maps_embed_url)}
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Localização de ${settings.displayName}`}
                  className="md:h-[500px]"
                />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden shadow-xl">
                <img
                  src={toolsImage}
                  alt={settings.displayName}
                  className="w-full h-[300px] md:h-[500px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
