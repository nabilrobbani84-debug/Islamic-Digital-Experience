import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SceneBoundary } from "./SceneBoundary";
import { detectRenderTier } from "@/lib/device";

function Boom(): never {
  throw new Error("WebGL gagal");
}

describe("SceneBoundary & fallback 3D", () => {
  it("jsdom tanpa WebGL terdeteksi sebagai tier 'none'", () => {
    expect(detectRenderTier()).toBe("none");
  });

  it("tier none menampilkan fallback 2D tanpa merender scene", () => {
    const scene = vi.fn(() => <div>scene</div>);
    render(
      <SceneBoundary tier="none" fallback={<div>fallback 2D</div>}>
        {scene}
      </SceneBoundary>,
    );
    expect(screen.getByText("fallback 2D")).toBeInTheDocument();
    expect(scene).not.toHaveBeenCalled();
  });

  it("error di scene diganti fallback, bukan halaman rusak", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <SceneBoundary tier="high" fallback={<div>fallback 2D</div>}>
        {() => <Boom />}
      </SceneBoundary>,
    );
    expect(screen.getByText("fallback 2D")).toBeInTheDocument();
    spy.mockRestore();
  });
});
