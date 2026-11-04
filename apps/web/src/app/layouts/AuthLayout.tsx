import { Outlet } from "react-router";
import { NurLogo } from "@/components/navigation/NurLogo";
import { GuestOnly } from "@/features/auth/guards";
import { HeroFallback2D } from "@/three/components/Fallbacks2D";

/** Layout autentikasi: panel visual di desktop, formulir terpusat di mobile. */
export function AuthLayout({ guestOnly = true }: { guestOnly?: boolean }) {
  const content = (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block" aria-hidden>
        <HeroFallback2D />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-transparent to-transparent" />
        <div className="absolute right-12 bottom-14 left-12">
          <p lang="ar" className="text-5xl text-gold-soft">
            نور
          </p>
          <p className="mt-4 max-w-md text-lg text-ivory/80">Your spiritual journey, reimagined.</p>
        </div>
      </aside>
      <main id="main" className="nur-pattern flex flex-col px-5 py-8 sm:px-10">
        <NurLogo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Outlet />
        </div>
        <p className="text-center text-xs text-muted">© NUR Islamic Digital Experience</p>
      </main>
    </div>
  );
  return guestOnly ? <GuestOnly>{content}</GuestOnly> : content;
}
