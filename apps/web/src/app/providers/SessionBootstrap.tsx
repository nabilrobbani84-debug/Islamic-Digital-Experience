import { useEffect } from "react";
import { useNavigate } from "react-router";
import { api } from "@/services/api";
import { startSyncEngine } from "@/services/offline/sync-engine";
import { useAuth } from "@/stores/auth";
import { bootstrapSession } from "@/features/auth/useSession";
import { toast } from "@/stores/ui";

/** Memulihkan sesi sekali saat aplikasi dimuat dan menjalankan sync engine saat pengguna masuk. */
export function SessionBootstrap() {
  const status = useAuth((s) => s.status);
  const navigate = useNavigate();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    return api.onUnauthorized(() => {
      if (useAuth.getState().status === "authenticated") {
        useAuth.getState().setUnauthenticated();
        toast.info("Sesi berakhir", "Silakan masuk kembali untuk melanjutkan.");
        navigate("/login", { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (status !== "authenticated" && status !== "offline-session") return;
    return startSyncEngine();
  }, [status]);

  return null;
}
