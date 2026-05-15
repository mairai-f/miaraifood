import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  ChefHat,
  LayoutDashboard,
  LogOut,
  Truck,
} from "lucide-react";
import foodLogo from "@/assets/happycashfood.webp";
import type { CustomerPaymentRequest, FoodOrder, FoodRole, FoodTable, FoodUser } from "@/types";
import { currency, orderTotal, tableOrder } from "@/lib/foodMetrics";

export type FoodView = "floor" | "kitchen" | "checkout" | "delivery" | "admin";

const navItems: Array<{ id: FoodView; label: string; icon: typeof LayoutDashboard; roles: FoodRole[] }> = [
  { id: "floor", label: "Mesas", icon: LayoutDashboard, roles: ["admin", "waiter", "cashier"] },
  { id: "kitchen", label: "Cozinha", icon: ChefHat, roles: ["admin", "kitchen", "cashier"] },
  { id: "checkout", label: "Caixa", icon: BadgeDollarSign, roles: ["admin", "cashier"] },
  { id: "delivery", label: "Delivery", icon: Truck, roles: ["admin", "cashier"] },
  { id: "admin", label: "Gestao", icon: BarChart3, roles: ["admin"] },
];

interface AppShellProps {
  activeView: FoodView;
  currentUser: FoodUser;
  tables: FoodTable[];
  orders: FoodOrder[];
  paymentRequests: CustomerPaymentRequest[];
  onViewChange: (view: FoodView) => void;
  onLogout: () => void;
  onOpenPaymentRequest: (requestId: string) => void;
  children: ReactNode;
}

const roleLabel: Record<FoodRole, string> = {
  admin: "Administrador",
  waiter: "Garcom",
  cashier: "Caixa",
  kitchen: "Cozinha",
  customer: "Cliente da mesa",
};

export function AppShell({
  activeView,
  currentUser,
  tables,
  orders,
  paymentRequests,
  onViewChange,
  onLogout,
  onOpenPaymentRequest,
  children,
}: AppShellProps) {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const isWaiterArea = currentUser.role === "waiter";
  const allowedNavItems = navItems.filter((item) => item.roles.includes(currentUser.role));
  const shortcutNavItems = allowedNavItems.map((item, index) => ({
    ...item,
    shortcut: String(index + 1),
  }));
  const newPaymentRequests = currentUser.role === "admin" || currentUser.role === "cashier"
    ? paymentRequests.filter((request) => request.status === "new")
    : [];

  useEffect(() => {
    const syncNetworkState = () => setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement
      && (
        target.isContentEditable
        || target.tagName === "INPUT"
        || target.tagName === "TEXTAREA"
        || target.tagName === "SELECT"
      );

    const handleShortcuts = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const closeButtons = Array.from(document.querySelectorAll<HTMLElement>("[data-modal-close='true']"));
        const closeButton = closeButtons.at(-1);
        if (closeButton) {
          event.preventDefault();
          closeButton.click();
          return;
        }
      }

      if (isTypingTarget(event.target)) return;
      const matchedItem = shortcutNavItems.find((item) => item.shortcut === event.key);
      if (!matchedItem) return;
      event.preventDefault();
      onViewChange(matchedItem.id);
    };

    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [onViewChange, shortcutNavItems]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-card px-4 py-5 shadow-panel lg:block">
        <div className="mb-7">
          <img
            src={foodLogo}
            alt="HappyCashFood"
            className="h-28 w-full rounded-lg object-contain p-1 shadow-sm"
            width={1536}
            height={1024}
            loading="eager"
            decoding="async"
          />
        </div>

        <nav className="space-y-1">
          {shortcutNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                aria-keyshortcuts={item.shortcut}
                title={`Atalho ${item.shortcut}`}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[11px] font-black ${
                  active ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-border bg-background text-foreground"
                }`}>
                  {item.shortcut}
                </span>
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-8 rounded-lg border bg-background p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Atalhos</p>
          <p className="mt-1 text-sm font-bold">1 a {shortcutNavItems.length} para menu</p>
          <p className="mt-2 text-xs text-muted-foreground">Esc fecha modal e Tab segue pelos campos.</p>
        </div>

        <div className="mt-3 rounded-lg border bg-background p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{roleLabel[currentUser.role]}</p>
          <p className="mt-1 text-sm font-bold">{currentUser.name}</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-bold"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b bg-card/95 px-4 py-3 backdrop-blur lg:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={foodLogo}
                alt="HappyCashFood"
                className="h-12 w-16 rounded-lg object-contain p-0.5 lg:hidden"
                width={1536}
                height={1024}
                loading="eager"
                decoding="async"
              />
              <div>
                <h2 className="text-xl font-black leading-tight sm:text-2xl">HappyCashFood</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
                {roleLabel[currentUser.role]}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${isOnline ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="hidden rounded-full border bg-card px-3 py-1 text-xs font-bold text-muted-foreground sm:inline-flex"
              >
                Sair
              </button>
              {!isWaiterArea && (
                <span className="hidden rounded-full border bg-card px-3 py-1 text-xs font-bold text-muted-foreground sm:inline-flex">
                  Fluxo Food
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {shortcutNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  aria-keyshortcuts={item.shortcut}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                  }`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded border text-[10px] font-black ${
                    active ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-border bg-background text-foreground"
                  }`}>
                    {item.shortcut}
                  </span>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </header>

        <main className="px-4 py-5 lg:px-7">{children}</main>
      </div>

      {newPaymentRequests.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 grid w-[calc(100vw-2rem)] max-w-md gap-3">
          {newPaymentRequests.slice(0, 3).map((request) => {
            const table = tables.find((item) => item.id === request.tableId);
            const order = tableOrder(orders, request.tableId);
            return (
              <button
                key={request.id}
                type="button"
                onClick={() => onOpenPaymentRequest(request.id)}
                className="rounded-lg border border-warning/50 bg-card p-4 text-left shadow-panel ring-2 ring-warning/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-warning">Cliente solicitou fechamento</p>
                    <p className="mt-1 text-lg font-black">Mesa {table?.number ?? "?"}</p>
                  </div>
                  <span className="rounded-lg bg-warning px-3 py-1 text-sm font-black text-warning-foreground">
                    {order ? currency.format(orderTotal(order)) : currency.format(0)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {order?.items.length ?? 0} itens na comanda. Toque para abrir no caixa.
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
