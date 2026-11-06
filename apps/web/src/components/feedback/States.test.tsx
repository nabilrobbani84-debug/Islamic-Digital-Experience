import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceNote, safeHttpsUrl } from "./States";

describe("safeHttpsUrl", () => {
  it("hanya menerima https yang valid", () => {
    expect(safeHttpsUrl("https://tanzil.net")).toBe("https://tanzil.net/");
    expect(safeHttpsUrl("http://tanzil.net")).toBeNull();
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl("bukan url")).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
    expect(safeHttpsUrl(undefined)).toBeNull();
  });
});

describe("SourceNote", () => {
  it("menampilkan nama sumber sebagai tautan aman bila URL https tersedia", () => {
    render(<SourceNote source="Sumber Teks" license="Lisensi X" version="v1" url="https://example.org/teks" />);
    const link = screen.getByRole("link", { name: "Sumber Teks" });
    expect(link).toHaveAttribute("href", "https://example.org/teks");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByTestId("source-note")).toHaveTextContent("Lisensi: Lisensi X");
    expect(screen.getByTestId("source-note")).toHaveTextContent("Versi dataset: v1");
  });

  it("tanpa tautan bila URL bukan https; teks sumber tetap tampil", () => {
    render(<SourceNote source="Sumber Teks" url="javascript:alert(1)" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("source-note")).toHaveTextContent("Sumber: Sumber Teks.");
  });

  it("mencantumkan atribusi dan lisensi terjemahan secara terpisah dari sumber teks", () => {
    render(<SourceNote source="Sumber Teks" url="https://example.org/teks" translation={{ name: "Penerjemah", url: "https://example.org/terjemahan", license: "CC-BY" }} />);
    expect(screen.getByRole("link", { name: "Penerjemah" })).toHaveAttribute("href", "https://example.org/terjemahan");
    expect(screen.getByTestId("source-note")).toHaveTextContent("Lisensi terjemahan: CC-BY");
  });

  it("tidak merender apa pun bila tidak ada informasi", () => {
    const { container } = render(<SourceNote />);
    expect(container).toBeEmptyDOMElement();
  });
});
