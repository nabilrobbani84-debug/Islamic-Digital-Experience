import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DhikrCounter } from "./DhikrCounter";

function Harness({ target = 3 }: { target?: number }) {
  const [count, setCount] = useState(0);
  return <DhikrCounter count={count} target={target} label="Tasbih" onIncrement={() => setCount((c) => c + 1)} />;
}

describe("DhikrCounter", () => {
  it("menambah hitungan dengan klik dan memperbarui progress ring", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole("button", { name: /tambah hitungan/i });
    await user.click(button);
    await user.click(button);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /progres tasbih/i })).toHaveAttribute("aria-valuenow", "67");
  });

  it("dapat dioperasikan dengan keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole("button", { name: /tambah hitungan/i });
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: /2 dari 3/i })).toBeInTheDocument();
  });
});
