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

describe("LocaleProvider", () => {
  it("keeps dynamic text nodes in sync after React updates", async () => {
    render(<DynamicCounter />);

    fireEvent.click(screen.getByRole("button", { name: "Incrementar" }));

    await waitFor(() => {
      expect(screen.getByText("Carrinho (1)")).toBeInTheDocument();
      expect(screen.getByText("Total: R$ 1.00")).toBeInTheDocument();
    });
  });
});
