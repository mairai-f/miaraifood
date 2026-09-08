import { enUS, ptBR } from "date-fns/locale";

import { getActiveLocale } from "./format";

export const getDateFnsLocale = () => (getActiveLocale() === "en" ? enUS : ptBR);
