import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { buildTvSlides, normalizeTvCode, TV_CODE_PATTERN, type TvPayload } from '@/features/tv/tvSlides';

// Tela pública de promoções para TV (Smart TV, TV box ou PC ligado por HDMI).
//
// Tráfego mínimo de propósito: o conteúdo é pedido a cada 5 minutos enviando a
// versão que a TV já tem; se nada mudou, a resposta volta vazia. As fotos são
// baixadas uma vez e ficam no cache do navegador.
const REFRESH_MS = 5 * 60 * 1000;
// TVs ficam ligadas por dias; recarregar de tempos em tempos libera a memória do navegador da TV.
const RELOAD_MS = 12 * 60 * 60 * 1000;
const CACHE_PREFIX = 'miar:tv:';
// A TV guarda o último código válido: depois da primeira vez, basta abrir /tv.
const LAST_CODE_KEY = 'miar:tv:last-code';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatMoney = (value: number) => money.format(value);
const formatDay = (value: string) => {
  const [, month, day] = value.split('-');
  return day && month ? `${day}/${month}` : value;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
};

function readCachedPayload(code: string): TvPayload | null {
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + code);
    return raw ? (JSON.parse(raw) as TvPayload) : null;
  } catch {
    return null;
  }
}

function writeCachedPayload(code: string, payload: TvPayload | null) {
  try {
    if (payload) window.localStorage.setItem(CACHE_PREFIX + code, JSON.stringify(payload));
    else window.localStorage.removeItem(CACHE_PREFIX + code);
  } catch {
    // Sem armazenamento local a TV só não abre offline.
  }
}

function readLastCode() {
  try {
    const code = window.localStorage.getItem(LAST_CODE_KEY) ?? '';
    return TV_CODE_PATTERN.test(code) ? code : null;
  } catch {
    return null;
  }
}

function writeLastCode(code: string | null) {
  try {
    if (code) window.localStorage.setItem(LAST_CODE_KEY, code);
    else window.localStorage.removeItem(LAST_CODE_KEY);
  } catch {
    // Sem armazenamento local a TV só pede o código de novo.
  }
}

function CodeEntry() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  useEffect(() => {
    const lastCode = readLastCode();
    if (lastCode) navigate(`/tv/${lastCode}`, { replace: true });
  }, [navigate]);
  const code = normalizeTvCode(value);
  const valid = TV_CODE_PATTERN.test(code);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-6 text-white">
      <h1 className="text-5xl font-black tracking-tight">MIAR TV</h1>
      <p className="max-w-2xl text-center text-2xl text-white/70">
        Digite o código desta TV. Ele aparece no sistema em Configurações › TV.
      </p>
      <form
        className="flex w-full max-w-lg flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) navigate(`/tv/${code}`);
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABCD2345"
          className="rounded-2xl bg-white/10 px-6 py-6 text-center font-mono text-5xl uppercase tracking-[0.3em] text-white outline-none placeholder:text-white/20 focus:ring-4 focus:ring-emerald-400"
        />
        <button
          type="submit"
          disabled={!valid}
          className="rounded-2xl bg-emerald-500 py-5 text-3xl font-bold text-black transition disabled:opacity-40"
        >
          Abrir
        </button>
      </form>
    </main>
  );
}

function TvPlayer({ code }: { code: string }) {
  const [payload, setPayload] = useState<TvPayload | null>(() => readCachedPayload(code));
  const [notFound, setNotFound] = useState(false);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const versionRef = useRef<string | null>(payload?.version ?? null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke<TvPayload & { unchanged?: boolean }>('tv-display', {
      body: { code, version: versionRef.current },
    });

    if (error) {
      const status = (error as { context?: Response }).context?.status;
      if (status === 404) {
        versionRef.current = null;
        setNotFound(true);
        setPayload(null);
        writeCachedPayload(code, null);
        writeLastCode(null);
      }
      // Sem rede ou função fora do ar: a TV continua mostrando o último conteúdo.
      return;
    }
    if (!data || data.unchanged) return;

    versionRef.current = data.version;
    setNotFound(false);
    setPayload(data);
    setIndex(0);
    writeCachedPayload(code, data);
    writeLastCode(code);
  }, [code]);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    const reload = window.setTimeout(() => window.location.reload(), RELOAD_MS);
    const handleOnline = () => void load();
    window.addEventListener('online', handleOnline);
    return () => {
      window.clearInterval(refresh);
      window.clearTimeout(reload);
      window.removeEventListener('online', handleOnline);
    };
  }, [load]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(clock);
  }, []);

  // Impede a TV/PC de apagar a tela enquanto exibe as promoções.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = (await (navigator as WakeLockNavigator).wakeLock?.request('screen')) ?? null;
      } catch {
        lock = null;
      }
    };
    void request();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const slides = useMemo(() => (payload ? buildTvSlides(payload, formatMoney, now.getTime()) : []), [payload, now]);
  const slideSeconds = slides[index % slides.length]?.seconds ?? payload?.screen.slide_seconds ?? 10;
  const current = slides.length ? slides[index % slides.length] : null;
  const next = slides.length > 1 ? slides[(index + 1) % slides.length] : null;

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % slides.length), slideSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [index, slideSeconds, slides.length]);

  // Baixa a próxima foto antes da troca, para não aparecer carregando na TV.
  useEffect(() => {
    if (!next?.imageUrl) return;
    const image = new Image();
    image.src = next.imageUrl;
  }, [next?.imageUrl]);

  const showPrices = payload?.screen.show_prices ?? true;

  return (
    <main
      onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
      className="relative flex h-screen w-screen cursor-none select-none flex-col overflow-hidden bg-black text-white"
    >
      <header className="flex items-center justify-between gap-[2vw] px-[4vw] py-[2.5vh]">
        <span className="truncate text-[2.2vw] font-black tracking-tight">{payload?.store_name || 'MIAR'}</span>
        {payload?.screen.headline && (
          <span className="truncate text-[2vw] font-semibold text-emerald-400">{payload.screen.headline}</span>
        )}
        <span className="font-mono text-[2vw] text-white/70">
          {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      <section className="flex min-h-0 flex-1 items-center px-[4vw] pb-[3vh]">
        {notFound ? (
          <p className="w-full text-center text-[3vw] text-white/70">Esta TV foi desativada ou o código mudou. Abra /tv e digite o código novo.</p>
        ) : !payload ? (
          <p className="w-full text-center text-[3vw] text-white/70">Carregando promoções...</p>
        ) : !current ? (
          <p className="w-full text-center text-[3vw] text-white/70">Nenhuma promoção ativa no momento.</p>
        ) : current.artwork ? (
          <img src={current.imageUrl!} alt={current.title} className="h-full w-full object-contain" />
        ) : (
          <div key={current.key} className="flex h-full w-full items-center gap-[4vw] animate-in fade-in duration-700">
            {current.imageUrl ? (
              <img
                src={current.imageUrl}
                alt=""
                decoding="async"
                className="h-[70vh] w-[45vw] shrink-0 rounded-[2vw] object-cover shadow-2xl"
              />
            ) : (
              <div className="flex h-[70vh] w-[45vw] shrink-0 items-center justify-center rounded-[2vw] bg-gradient-to-br from-emerald-500/40 to-emerald-950 text-[14vw] font-black text-white/25">
                {current.title.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-[2.5vh]">
              {current.badge && (
                <span className="w-fit rounded-full bg-red-600 px-[2vw] py-[1vh] text-[2.6vw] font-black uppercase">
                  {current.badge}
                </span>
              )}
              <h1 className="text-[5vw] font-black leading-[1.05]">{current.title}</h1>
              {current.subtitle && <p className="line-clamp-3 text-[2.2vw] text-white/75">{current.subtitle}</p>}
              {showPrices && current.price !== null && (
                <div className="flex flex-wrap items-baseline gap-x-[2vw]">
                  {current.originalPrice !== null && current.originalPrice > current.price && (
                    <span className="text-[3vw] text-white/50 line-through">{formatMoney(current.originalPrice)}</span>
                  )}
                  <span className="text-[7vw] font-black leading-none text-emerald-400">{formatMoney(current.price)}</span>
                </div>
              )}
              {current.endsAt && <p className="text-[1.8vw] text-white/60">Válido até {formatDay(current.endsAt)}</p>}
            </div>
          </div>
        )}
      </section>

      {payload?.screen.footer_message && (
        <footer className="bg-emerald-500 px-[4vw] py-[1.6vh] text-center text-[2.2vw] font-bold text-black">
          {payload.screen.footer_message}
        </footer>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-[1vh] left-1/2 flex -translate-x-1/2 gap-[0.6vw]">
          {slides.map((slide, position) => (
            <span
              key={slide.key}
              className={`h-[0.8vh] w-[1.6vw] rounded-full ${position === index % slides.length ? 'bg-white' : 'bg-white/25'}`}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default function TvDisplay() {
  const params = useParams<{ token?: string }>();
  const code = normalizeTvCode(params.token ?? '');
  if (!TV_CODE_PATTERN.test(code)) return <CodeEntry />;
  return <TvPlayer key={code} code={code} />;
}
