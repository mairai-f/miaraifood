import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

const SESSION_REFRESH_MARGIN_SECONDS = 60;

const isSessionExpiringSoon = (session: Session) => {
  if (!session.expires_at) return true;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return session.expires_at <= currentTimestamp + SESSION_REFRESH_MARGIN_SECONDS;
};

const refreshSiteSession = async () => {
  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    return null;
  }

  return data.session ?? null;
};

export const getFreshSiteSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  const currentSession = data.session;

  if (!currentSession) {
    return null;
  }

  if (isSessionExpiringSoon(currentSession)) {
    const refreshedSession = await refreshSiteSession();

    if (refreshedSession?.access_token) {
      return refreshedSession;
    }
  }

  if (currentSession.access_token) {
    const { data: userData, error: userError } = await supabase.auth.getUser(currentSession.access_token);

    if (!userError && userData.user) {
      return currentSession;
    }
  }

  if (!currentSession.refresh_token) {
    return null;
  }

  const refreshedSession = await refreshSiteSession();
  return refreshedSession?.access_token ? refreshedSession : null;
};
