import type { ReactNode } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  ChefHat,
  Download,
  LayoutDashboard,
  LogOut,
  QrCode,
  Truck,
} from "lucide-react";
import foodLogo from "@/assets/happycashfood.webp";
import type { CustomerPaymentRequest, FoodOrder, FoodRole, FoodTable, FoodUser } from "@/types";
import { currency, orderTotal, tableOrder } from "@/lib/foodMetrics";

export type FoodView = "floor" | "kitchen" | "checkout" | "menu" | "delivery" | "admin" | "downloads";

const navItems: Array<{ id: FoodView; label: string; icon: typeof LayoutDashboard; roles: FoodRole[] }> = [
  { id: "floor", label: "Mesas", icon: LayoutDashboard, roles: ["admin", "waiter", "cashier"] },
  { id: "kitchen", label: "Cozinha", icon: ChefHat, roles: ["admin", "kitchen", "cashier"] },
  { id: "checkout", label: "Caixa", icon: BadgeDollarSign, roles: ["admin", "cashier"] },
  { id: "menu", label: "QR/Menu", icon: QrCode, roles: ["admin", "customer"] },
  { id: "delivery", label: "Delivery", icon: Truck, roles: ["admin", "cashier"] },
  { id: "downloads", label: "Downloads", icon: Download, roles: ["admin"] },
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
  customer: "Cliente QR",
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
  const allowedNavItems = navItems.filter((item) => item.roles.includes(currentUser.role));
  const newPaymentRequests = currentUser.role === "admin" || currentUser.role === "cashier"
    ? paymentRequests.filter((request) => request.status === "new")
    : [];

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
          <div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">HappyCashFood</p>
            <h1 className="text-2xl font-black leading-none">Restaurante</h1>
          </div>
        </div>

        <nav className="space-y-1">
          {allowedNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-8 rounded-lg border bg-muted/50 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Loja ativa</p>
          <p className="mt-1 text-sm font-bold">Demo Restaurante</p>
          <p className="mt-2 text-xs text-muted-foreground">Plano Food R$ 250 web ou R$ 310 offline.</p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Operacao em tempo real</p>
                <h2 className="text-xl font-black leading-tight sm:text-2xl">HappyCashFood</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
                {roleLabel[currentUser.role]}
              </span>
              <span className="rounded-full border bg-success/10 px-3 py-1 text-xs font-bold text-success">
                Online
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="hidden rounded-full border bg-card px-3 py-1 text-xs font-bold text-muted-foreground sm:inline-flex"
              >
                Sair
              </button>
              <span className="hidden rounded-full border bg-card px-3 py-1 text-xs font-bold text-muted-foreground sm:inline-flex">
                Caixa aberto
              </span>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {allowedNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                  }`}
                >
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
