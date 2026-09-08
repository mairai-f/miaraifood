/**
 * Bandeira do idioma como imagem real (não emoji).
 *
 * Emoji de bandeira (sequência de "regional indicator symbols") depende da
 * fonte do sistema operacional. No Windows a fonte padrão não tem os
 * desenhos das bandeiras e cai para as duas letras da sigla do país
 * (ex.: "BR" em vez da bandeira do Brasil) — foi isso que apareceu no
 * relato do usuário como "siglas em vez das bandeiras".
 *
 * Para garantir a bandeira de verdade em qualquer aparelho, usamos uma
 * imagem (flagcdn.com), não o emoji.
 */
const PAIS_CODIGO: Record<string, string> = {
  pt: 'br',
  es: 'es',
  gn: 'py',
  en: 'us',
  fr: 'fr',
  de: 'de',
  it: 'it',
  nl: 'nl',
  zh: 'cn',
  ja: 'jp',
  ko: 'kr',
  ar: 'sa',
  hi: 'in',
  ru: 'ru',
  tr: 'tr',
  pl: 'pl',
  uk: 'ua',
  sw: 'ke',
  id: 'id',
};

export function Bandeira({ codigo, className = '' }: { codigo: string; className?: string }) {
  const pais = PAIS_CODIGO[codigo];
  if (!pais) return null;
  return (
    <img
      src={`https://flagcdn.com/24x18/${pais}.png`}
      srcSet={`https://flagcdn.com/48x36/${pais}.png 2x`}
      width={20}
      height={15}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={`inline-block shrink-0 rounded-[2px] object-cover align-middle ${className}`}
    />
  );
}
