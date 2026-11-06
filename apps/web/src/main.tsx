import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";
import "./styles/index.css";
import { AppProviders } from "./app/providers/AppProviders";
import { createAppRouter } from "./app/router";
import { registerPwa } from "./services/pwa";

const router = createAppRouter();
const container = document.getElementById("root");
if (!container) throw new Error("Elemen #root tidak ditemukan");

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);

void registerPwa();
