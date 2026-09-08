import { useAuthSession } from "@/hooks/use-auth-session";
import { useCurrentSubscription } from "@/hooks/use-current-subscription";
import { isCurrentSubscription } from "@/lib/subscriptionStatus";

export function useLandingAccountActions() {
  const { user, isAuthenticated, loading: loadingAuth } = useAuthSession();
  const { subscription, loading: loadingSubscription } = useCurrentSubscription(user?.id);
  const hasActivePaidPlan = Boolean(
    subscription &&
      subscription.plan_id !== "demo" &&
      isCurrentSubscription(subscription),
  );

  return {
    isAuthenticated,
    loading: loadingAuth || loadingSubscription,
    showCreateAccount: !isAuthenticated,
    showTestButton: !hasActivePaidPlan,
    testHref: isAuthenticated ? "/dashboard#planos" : "/cadastro?plan=demo",
    createAccountHref: "/cadastro",
    hasActivePaidPlan,
  };
}
