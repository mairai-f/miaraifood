import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../../shared/locale/LocaleContext";

function DynamicCounter() {
  const [count, setCount] = useState(0);

  return (
    <LocaleProvider>
      <div>
        <p>Carrinho ({count})</p>
        <p>Total: R$ {count.toFixed(2)}</p>
        <button type="button" onClick={() => setCount((current) => current + 1)}>
          Incrementar
        </button>
      </div>
    </LocaleProvider>
  );
}

function DynamicDebtCart() {
  const [quantity, setQuantity] = useState(0);
  const total = quantity * 2.5;

  return (
    <LocaleProvider>
      <div>
        <button type="button" onClick={() => setQuantity((current) => current + 1)}>
          Adicionar produto
        </button>
        {quantity > 0 && (
          <div>
            <p>Lista (1 item):</p>
            <p>Cafe x{quantity}</p>
            <p>Total: R$ {total.toFixed(2)}</p>
          </div>
        )}
      </div>
    </LocaleProvider>
  );
}

describe("LocaleProvider", () => {
  it("keeps dynamic text nodes in sync after React updates", async () => {
    render(<DynamicCounter />);

    fireEvent.click(screen.getByRole("button", { name: "Incrementar" }));

    await waitFor(() => {
      expect(screen.getByText("Carrinho (1)")).toBeInTheDocument();
      expect(screen.getByText("Total: R$ 1.00")).toBeInTheDocument();
    });
  });

  it("keeps caderneta cart quantity and total in sync after repeated additions", async () => {
    render(<DynamicDebtCart />);

    const addButton = screen.getByRole("button", { name: "Adicionar produto" });

    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Cafe x1")).toBeInTheDocument();
      expect(screen.getByText("Total: R$ 2.50")).toBeInTheDocument();
    });

    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Cafe x2")).toBeInTheDocument();
      expect(screen.getByText("Total: R$ 5.00")).toBeInTheDocument();
    });
  });
});
