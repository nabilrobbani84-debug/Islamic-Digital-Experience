import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Compass, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PageLoader() {
  return (
    <div className="grid min-h-[50dvh] place-items-center" role="status" aria-label="Memuat halaman">
      <LoaderCircle className="size-8 animate-spin text-gold" aria-hidden />
    </div>
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);
  return (
    <main className="nur-pattern grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <Compass className="mx-auto mb-6 size-12 text-gold" aria-hidden />
        <h1 className="text-2xl font-bold text-fg">{notFound ? "Halaman tidak ditemukan" : "Terjadi kesalahan"}</h1>
        <p className="mt-3 text-muted">
          {notFound
            ? "Alamat yang Anda buka tidak tersedia."
            : chunkFailed
              ? "Versi aplikasi baru tersedia atau koneksi terputus saat memuat halaman. Muat ulang untuk melanjutkan."
              : "Halaman ini gagal ditampilkan. Silakan muat ulang atau kembali ke beranda."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Muat ulang
          </Button>
          <Link to="/" className="inline-flex h-11 items-center rounded-xl bg-emerald-nur px-5 text-sm font-semibold text-ivory">
            Ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="nur-pattern grid min-h-[70dvh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-6xl font-bold text-gold-text">404</p>
        <h1 className="mt-4 text-2xl font-bold text-fg">Halaman tidak ditemukan</h1>
        <p className="mt-3 text-muted">Alamat yang Anda buka tidak tersedia.</p>
        <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-emerald-nur px-5 text-sm font-semibold text-ivory">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
