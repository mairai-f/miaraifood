import { useEffect, useMemo, useState } from "react";
import { AppShell, type FoodView } from "@/components/AppShell";
import { AdminPanel } from "@/components/AdminPanel";
import { CheckoutPanel } from "@/components/CheckoutPanel";
import { DeliveryPanel } from "@/components/DeliveryPanel";
import { KitchenDisplay } from "@/components/KitchenDisplay";
import { LoginScreen } from "@/components/LoginScreen";
import { MetricStrip } from "@/components/MetricStrip";
import { TableBoard } from "@/components/TableBoard";
import {
  demoUsers,
  initialClosureReceipts,
  initialDeliveries,
  initialOrders,
  initialTables,
  initialWaiters,
  menuProducts,
  userPins as defaultUserPins,
} from "@/data/mockData";
import {
  buildItemFromProduct,
  nextKitchenStatus,
  orderServiceFee,
  orderSubtotal,
  orderTotal,
  tableOrder,
} from "@/lib/foodMetrics";
import type {
  CustomerPaymentRequest,
  DeliveryOrder,
  DeliveryStatus,
  FoodClosureReceipt,
  FoodOrder,
  FoodOrderItem,
  FoodTable,
  FoodUser,
  FoodWaiter,
  KitchenStatus,
  KitchenTicket,
  MenuProduct,
  PaymentMethod,
  Station,
} from "@/types";

const activeItems = (items: FoodOrderItem[]) => items.filter((item) => item.status !== "cancelled");

const resolveOrderStatus = (items: FoodOrderItem[], currentStatus: FoodOrder["status"]): FoodOrder["status"] => {
  if (currentStatus === "closing" || currentStatus === "paid") return currentStatus;
  const validItems = activeItems(items);
  if (validItems.length === 0) return "open";
  if (validItems.every((item) => item.status === "delivered")) return "served";
  if (validItems.some((item) => item.status === "ready")) return "ready";
  if (validItems.some((item) => item.status === "preparing")) return "preparing";
  return "sent";
};

const groupTickets = (
  orders: FoodOrder[],
  deliveries: DeliveryOrder[],
): KitchenTicket[] => {
  const grouped = new Map<string, KitchenTicket>();

  const appendItems = (
    orderId: string,
    tableNumber: string,
    station: Station,
    status: KitchenStatus,
    items: FoodOrderItem[],
  ) => {
    const relevant = activeItems(items).filter((item) => item.station === station && item.status === status);
    if (relevant.length === 0) return;
    const key = `${orderId}-${station}-${status}`;
    grouped.set(key, {
      id: key,
      orderId,
      tableNumber,
      station,
      status,
      createdAt: relevant.reduce((oldest, item) => (
        new Date(item.createdAt).getTime() < new Date(oldest).getTime() ? item.createdAt : oldest
      ), relevant[0].createdAt),
      items: relevant,
    });
  };

  for (const order of orders.filter((item) => item.status !== "paid")) {
    const tableNumber = order.tableId.replace("table-", "").toUpperCase();
    (["kitchen", "bar", "counter"] as Station[]).forEach((station) => {
      (["received", "preparing", "ready", "delivered"] as KitchenStatus[]).forEach((status) => {
        appendItems(order.id, tableNumber, station, status, order.items);
      });
    });
  }

  for (const delivery of deliveries) {
    (["kitchen", "bar", "counter"] as Station[]).forEach((station) => {
      (["received", "preparing", "ready", "delivered"] as KitchenStatus[]).forEach((status) => {
        appendItems(delivery.id, "Delivery", station, status, delivery.items);
      });
    });
  }

  return Array.from(grouped.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
};

const nextDeliveryStatus = (status: DeliveryStatus): DeliveryStatus => {
  if (status === "new") return "preparing";
  if (status === "preparing") return "out";
  if (status === "out") return "delivered";
  return "delivered";
};

const firstViewForRole = (user: FoodUser): FoodView => {
  if (user.role === "kitchen") return "kitchen";
  if (user.role === "cashier") return "checkout";
  return "floor";
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<FoodUser | null>(null);
  const [appUsers, setAppUsers] = useState<FoodUser[]>(demoUsers);
  const [loginPins, setLoginPins] = useState<Record<string, string>>(defaultUserPins);
  const [activeView, setActiveView] = useState<FoodView>("floor");
  const [tables, setTables] = useState<FoodTable[]>(initialTables);
  const [orders, setOrders] = useState<FoodOrder[]>(initialOrders);
  const [products, setProducts] = useState<MenuProduct[]>(menuProducts);
  const [waiters, setWaiters] = useState<FoodWaiter[]>(initialWaiters);
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>(initialDeliveries);
  const [paymentRequests, setPaymentRequests] = useState<CustomerPaymentRequest[]>([]);
  const [closureReceipts, setClosureReceipts] = useState<FoodClosureReceipt[]>(initialClosureReceipts);
  const [selectedTableId, setSelectedTableId] = useState(initialTables[0].id);
  const [note, setNote] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrders[0]?.id ?? "");
  const [splitCount, setSplitCount] = useState(1);
  const [pendingRemoval, setPendingRemoval] = useState<{ orderId: string; itemId: string } | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState("");

  const tickets = useMemo(() => groupTickets(orders, deliveries), [orders, deliveries]);
  const pendingRemovalOrder = pendingRemoval
    ? orders.find((order) => order.id === pendingRemoval.orderId)
    : undefined;
  const pendingRemovalItem = pendingRemovalOrder && pendingRemoval
    ? pendingRemovalOrder.items.find((item) => item.id === pendingRemoval.itemId)
    : undefined;
  const pendingRemovalTable = pendingRemovalOrder
    ? tables.find((table) => table.id === pendingRemovalOrder.tableId)
    : undefined;

  useEffect(() => {
    if (!pendingRemoval) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [pendingRemoval]);
  const readyItems = tickets
    .filter((ticket) => ticket.status === "ready")
    .reduce((sum, ticket) => sum + ticket.items.reduce((subtotal, item) => subtotal + item.quantity, 0), 0);

  const login = (user: FoodUser) => {
    setCurrentUser(user);
    setActiveView(firstViewForRole(user));
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
    if (user.tableId) {
      setSelectedTableId(user.tableId);
      const order = tableOrder(orders, user.tableId);
      if (order) setSelectedOrderId(order.id);
    }
  };

  const openTable = (tableId: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    const table = tables.find((item) => item.id === tableId);
    const waiterName = currentUser.role === "waiter" ? currentUser.name : table?.waiterName || waiters[0]?.name || "Garcom";

    setTables((currentTables) =>
      currentTables.map((currentTable) =>
        currentTable.id === tableId && currentTable.status === "free"
          ? {
              ...currentTable,
              status: "occupied",
              customerName: `Mesa ${currentTable.number}`,
              waiterName,
              openedAt: now,
            }
          : currentTable,
      ),
    );

    setOrders((currentOrders) => {
      const alreadyOpen = currentOrders.some((order) => order.tableId === tableId && order.status !== "paid");
      if (alreadyOpen) return currentOrders;
      const order: FoodOrder = {
        id: `order-${Date.now()}`,
        tableId,
        customerName: `Mesa ${table?.number ?? ""}`.trim(),
        waiterName,
        openedAt: now,
        status: "open",
        serviceFeePercent: 10,
        discount: 0,
        items: [],
      };
      setSelectedOrderId(order.id);
      return [order, ...currentOrders];
    });
  };

  const addProductToTable = (
    tableId: string,
    product: MenuProduct,
    itemNote: string,
    selectedOptions: string[] = [],
    unitPrice = product.price,
  ) => {
    const existingOrder = tableOrder(orders, tableId);
    const item = buildItemFromProduct(product, itemNote, selectedOptions, unitPrice);
    const now = new Date().toISOString();
    const selectedTable = tables.find((table) => table.id === tableId);
    const waiterName = currentUser?.role === "waiter" ? currentUser.name : selectedTable?.waiterName || waiters[0]?.name || "Garcom";

    if (!existingOrder) {
      const order: FoodOrder = {
        id: `order-${Date.now()}`,
        tableId,
        customerName: selectedTable?.customerName || `Mesa ${selectedTable?.number ?? ""}`.trim(),
        waiterName,
        openedAt: selectedTable?.openedAt || now,
        status: "sent",
        serviceFeePercent: 10,
        discount: 0,
        items: [item],
      };
      setOrders((currentOrders) => [order, ...currentOrders]);
      setSelectedOrderId(order.id);
    } else {
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === existingOrder.id
            ? {
                ...order,
                status: resolveOrderStatus([...order.items, item], order.status),
                items: [...order.items, item],
              }
            : order,
        ),
      );
      setSelectedOrderId(existingOrder.id);
    }

    setTables((currentTables) =>
      currentTables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              status: "occupied",
              customerName: table.customerName || `Mesa ${table.number}`,
              waiterName: table.waiterName || waiterName,
              openedAt: table.openedAt || now,
            }
          : table,
      ),
    );

    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.id === product.id
          ? { ...currentProduct, stock: Math.max(0, currentProduct.stock - 1) }
          : currentProduct,
      ),
    );
    setNote("");
  };

  const addProductToSelectedTable = (product: MenuProduct) => {
    addProductToTable(selectedTableId, product, note.trim());
  };

  const transferSelectedTable = () => {
    if (!transferTargetId || transferTargetId === selectedTableId) return;
    const sourceOrder = tableOrder(orders, selectedTableId);
    if (!sourceOrder) return;
    const targetOrder = tableOrder(orders, transferTargetId);

    setOrders((currentOrders) => {
      if (!targetOrder) {
        return currentOrders.map((order) =>
          order.id === sourceOrder.id ? { ...order, tableId: transferTargetId } : order,
        );
      }

      return currentOrders
        .map((order) =>
          order.id === targetOrder.id
            ? {
                ...order,
                items: [...order.items, ...sourceOrder.items],
                discount: order.discount + sourceOrder.discount,
                status: resolveOrderStatus([...order.items, ...sourceOrder.items], order.status),
              }
            : order,
        )
        .filter((order) => order.id !== sourceOrder.id);
    });

    setTables((currentTables) =>
      currentTables.map((table) => {
        if (table.id === selectedTableId) {
          return { ...table, status: "free", customerName: undefined, waiterName: undefined, openedAt: undefined };
        }
        if (table.id === transferTargetId) {
          return { ...table, status: "occupied", customerName: table.customerName || sourceOrder.customerName, openedAt: table.openedAt || sourceOrder.openedAt };
        }
        return table;
      }),
    );

    setSelectedTableId(transferTargetId);
    setTransferTargetId("");
  };

  const setTableClosing = (tableId: string, openCheckout = true) => {
    const order = tableOrder(orders, tableId);
    if (!order) return;
    setTables((currentTables) =>
      currentTables.map((table) => (table.id === tableId ? { ...table, status: "closing" } : table)),
    );
    setOrders((currentOrders) =>
      currentOrders.map((currentOrder) =>
        currentOrder.id === order.id ? { ...currentOrder, status: "closing" } : currentOrder,
      ),
    );
    setSelectedOrderId(order.id);
    setSelectedTableId(tableId);
    if (openCheckout && currentUser?.role !== "waiter" && currentUser?.role !== "customer") {
      setActiveView("checkout");
    }
  };

  const advanceTicket = (ticketId: string) => {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket || ticket.status === "delivered") return;
    const nextStatus = nextKitchenStatus(ticket.status);
    const itemIds = new Set(ticket.items.map((item) => item.id));

    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== ticket.orderId) return order;
        const nextItems = order.items.map((item) =>
          itemIds.has(item.id) ? { ...item, status: nextStatus } : item,
        );
        return { ...order, items: nextItems, status: resolveOrderStatus(nextItems, order.status) };
      }),
    );

    setDeliveries((currentDeliveries) =>
      currentDeliveries.map((delivery) => {
        if (delivery.id !== ticket.orderId) return delivery;
        return {
          ...delivery,
          items: delivery.items.map((item) =>
            itemIds.has(item.id) ? { ...item, status: nextStatus } : item,
          ),
        };
      }),
    );
  };

  const closeOrder = (
    orderId: string,
    method: PaymentMethod,
    details: { discount: number; cashReceived: number; paidBy: string },
  ) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    const table = tables.find((item) => item.id === order.tableId);
    const payableOrder = { ...order, discount: details.discount };
    const receipt: FoodClosureReceipt = {
      id: `closure-${Date.now()}`,
      orderId,
      tableId: order.tableId,
      tableNumber: table?.number ?? "",
      paidAt: new Date().toISOString(),
      method,
      subtotal: orderSubtotal(order),
      serviceFee: orderServiceFee(order),
      discount: details.discount,
      total: orderTotal(payableOrder),
      paidBy: details.paidBy,
      waiterName: order.waiterName,
      items: order.items
        .filter((item) => item.status !== "cancelled")
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          revenue: item.quantity * item.unitPrice,
        })),
    };

    setOrders((currentOrders) =>
      currentOrders.map((currentOrder) =>
        currentOrder.id === orderId
          ? {
              ...currentOrder,
              discount: details.discount,
              status: "paid",
              items: currentOrder.items.map((item) => item.status === "cancelled" ? item : { ...item, status: "delivered" }),
            }
          : currentOrder,
      ),
    );
    setTables((currentTables) =>
      currentTables.map((currentTable) =>
        currentTable.id === order.tableId
          ? { ...currentTable, status: "free", customerName: undefined, waiterName: undefined, openedAt: undefined }
          : currentTable,
      ),
    );
    setPaymentRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.orderId === orderId ? { ...request, status: "acknowledged" } : request,
      ),
    );
    setClosureReceipts((currentReceipts) => [receipt, ...currentReceipts]);
    setSelectedOrderId("");
    setSplitCount(1);
  };

  const advanceDelivery = (deliveryId: string) => {
    setDeliveries((currentDeliveries) =>
      currentDeliveries.map((delivery) =>
        delivery.id === deliveryId
          ? { ...delivery, status: nextDeliveryStatus(delivery.status) }
          : delivery,
      ),
    );
  };

  const createDelivery = (delivery: {
    customerName: string;
    phone: string;
    address: string;
    productId: string;
    quantity: number;
    deliveryFee: number;
    paymentMethod: PaymentMethod;
    note: string;
  }) => {
    const product = products.find((item) => item.id === delivery.productId);
    if (!product) return;

    const quantity = Math.max(1, delivery.quantity);
    const item = {
      ...buildItemFromProduct(product, delivery.note),
      quantity,
    };

    setDeliveries((currentDeliveries) => [
      {
        id: `delivery-${Date.now()}`,
        customerName: delivery.customerName,
        phone: delivery.phone,
        address: delivery.address,
        status: "new",
        createdAt: new Date().toISOString(),
        deliveryFee: delivery.deliveryFee,
        paymentMethod: delivery.paymentMethod,
        items: [item],
      },
      ...currentDeliveries,
    ]);

    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.id === product.id
          ? { ...currentProduct, stock: Math.max(0, currentProduct.stock - quantity) }
          : currentProduct,
      ),
    );
  };

  const cancelOrderItem = (orderId: string, itemId: string) => {
    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId) return order;
        const nextItems = order.items.map((item) =>
          item.id === itemId ? { ...item, status: "cancelled" as const, notes: item.notes || "Cancelado" } : item,
        );
        return { ...order, items: nextItems, status: resolveOrderStatus(nextItems, order.status) };
      }),
    );
  };

  const requestRemoveItem = (orderId: string, itemId: string) => {
    setPendingRemoval({ orderId, itemId });
    setAdminPassword("");
    setAdminPasswordError("");
  };

  const closeRemovalModal = () => {
    setPendingRemoval(null);
    setAdminPassword("");
    setAdminPasswordError("");
  };

  const confirmAdminRemoval = () => {
    if (!pendingRemoval) return;
    if (adminPassword.trim() !== loginPins.admin) {
      setAdminPasswordError("Senha da conta administradora invalida.");
      return;
    }
    cancelOrderItem(pendingRemoval.orderId, pendingRemoval.itemId);
    closeRemovalModal();
  };

  const requestCustomerPayment = (tableId: string) => {
    const order = tableOrder(orders, tableId);
    if (!order) return;
    const alreadyOpen = paymentRequests.some((request) => request.orderId === order.id && request.status === "new");
    if (!alreadyOpen) {
      setPaymentRequests((currentRequests) => [
        {
          id: `request-${Date.now()}`,
          tableId,
          orderId: order.id,
          requestedAt: new Date().toISOString(),
          status: "new",
        },
        ...currentRequests,
      ]);
    }
    setTableClosing(tableId, false);
  };

  const openPaymentRequest = (requestId: string) => {
    const request = paymentRequests.find((item) => item.id === requestId);
    if (!request) return;
    setSelectedTableId(request.tableId);
    setSelectedOrderId(request.orderId);
    setPaymentRequests((currentRequests) =>
      currentRequests.map((item) => item.id === requestId ? { ...item, status: "acknowledged" } : item),
    );
    setActiveView("checkout");
  };

  const addTable = (table: { number: string; area: string; seats: number }) => {
    setTables((currentTables) => [
      ...currentTables,
      {
        id: `table-${Date.now()}`,
        number: table.number,
        area: table.area,
        seats: table.seats,
        status: "free",
      },
    ]);
  };

  const addWaiter = (waiter: Omit<FoodWaiter, "id">) => {
    const id = `waiter-${Date.now()}`;
    setWaiters((currentWaiters) => [...currentWaiters, { ...waiter, id }]);
    setAppUsers((currentUsers) => [
      ...currentUsers,
      { id: `user-${id}`, name: waiter.name, username: waiter.username, role: "waiter" },
    ]);
    setLoginPins((currentPins) => ({ ...currentPins, [waiter.username]: waiter.pin }));
  };

  const updateWaiter = (waiter: FoodWaiter) => {
    setWaiters((currentWaiters) =>
      currentWaiters.map((currentWaiter) => currentWaiter.id === waiter.id ? waiter : currentWaiter),
    );
  };

  const addProduct = (product: Omit<MenuProduct, "id">) => {
    setProducts((currentProducts) => [
      { ...product, id: `prod-${Date.now()}` },
      ...currentProducts,
    ]);
  };

  const updateProduct = (product: MenuProduct) => {
    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) => currentProduct.id === product.id ? product : currentProduct),
    );
  };

  const deleteTable = (tableId: string) => {
    if (orders.some((order) => order.tableId === tableId && order.status !== "paid")) return;
    const nextTables = tables.filter((table) => table.id !== tableId);
    setTables(nextTables);
    if (selectedTableId === tableId) {
      setSelectedTableId(nextTables[0]?.id ?? "");
    }
  };

  const deleteProduct = (productId: string) => {
    setProducts((currentProducts) => currentProducts.filter((product) => product.id !== productId));
  };

  if (!currentUser) {
    return <LoginScreen users={appUsers} loginPins={loginPins} onLogin={login} />;
  }

  const showOperationalSummary = currentUser.role === "admin" || currentUser.role === "cashier" || currentUser.role === "kitchen";

  const currentView = (() => {
    if (activeView === "kitchen") {
      return <KitchenDisplay tickets={tickets} orders={orders} tables={tables} onAdvanceTicket={advanceTicket} />;
    }

    if (activeView === "checkout") {
      return (
        <CheckoutPanel
          orders={orders}
          tables={tables}
          selectedOrderId={selectedOrderId}
          splitCount={splitCount}
          onSelectOrder={setSelectedOrderId}
          onSplitCountChange={setSplitCount}
          onCloseOrder={closeOrder}
        />
      );
    }

    if (activeView === "delivery") {
      return (
        <DeliveryPanel
          deliveries={deliveries}
          products={products}
          onAdvanceDelivery={advanceDelivery}
          onCreateDelivery={createDelivery}
        />
      );
    }

    if (activeView === "admin") {
      return (
        <AdminPanel
          tables={tables}
          orders={orders}
          products={products}
          waiters={waiters}
          closureReceipts={closureReceipts}
          onAddTable={addTable}
          onDeleteTable={deleteTable}
          onAddWaiter={addWaiter}
          onUpdateWaiter={updateWaiter}
          onAddProduct={addProduct}
          onUpdateProduct={updateProduct}
          onDeleteProduct={deleteProduct}
        />
      );
    }

    return (
      <TableBoard
        tables={tables}
        orders={orders}
        products={products}
        role={currentUser.role}
        selectedTableId={selectedTableId}
        note={note}
        transferTargetId={transferTargetId}
        onSelectTable={setSelectedTableId}
        onOpenTable={openTable}
        onAddProduct={addProductToSelectedTable}
        onNoteChange={setNote}
        onTransferTargetChange={setTransferTargetId}
        onTransferTable={transferSelectedTable}
        onSetClosing={() => setTableClosing(selectedTableId)}
        onRemoveItem={requestRemoveItem}
      />
    );
  })();

  return (
    <AppShell
      activeView={activeView}
      currentUser={currentUser}
      tables={tables}
      orders={orders}
      paymentRequests={paymentRequests}
      onViewChange={setActiveView}
      onLogout={() => setCurrentUser(null)}
      onOpenPaymentRequest={openPaymentRequest}
    >
      <div className="space-y-5">
        {showOperationalSummary && <MetricStrip tables={tables} orders={orders} readyItems={readyItems} />}
        {closureReceipts[0] && showOperationalSummary && (
          <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm font-bold text-success">
            Ultimo fechamento: mesa {closureReceipts[0].tableNumber} - {closureReceipts[0].paidBy} - {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(closureReceipts[0].total)}
          </div>
        )}
        {currentView}
      </div>

      {pendingRemoval && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-foreground/55 p-3"
          onClick={closeRemovalModal}
        >
          <div
            className="w-full max-w-xl rounded-2xl border bg-card p-5 shadow-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Confirmacao do administrador</p>
            <h4 className="mt-1 text-2xl font-black">Cancelar item da comanda</h4>
            <p className="mt-3 rounded-lg border bg-background p-3 text-sm font-bold">
              Tem certeza que deseja cancelar{" "}
              <span className="text-primary">
                {pendingRemovalItem ? `${pendingRemovalItem.quantity}x ${pendingRemovalItem.productName}` : "este item"}
              </span>{" "}
              da Mesa {pendingRemovalTable?.number ?? "?"}?
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              O item fica marcado como cancelado e deixa de entrar no total da comanda.
            </p>
            <label className="mt-4 grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Senha da conta administradora</span>
            <input
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              className="h-11 w-full rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2"
              type="password"
              autoComplete="current-password"
              placeholder="Digite a senha do administrador"
            />
            </label>
            {adminPasswordError && <p className="mt-2 text-sm font-bold text-destructive">{adminPasswordError}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeRemovalModal}
                data-modal-close="true"
                className="rounded-lg border bg-background px-4 py-2 text-sm font-black"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmAdminRemoval}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-black text-destructive-foreground"
              >
                Cancelar item
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
