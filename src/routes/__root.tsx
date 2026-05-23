import { Outlet, createRootRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Dev-only router devtools, code-split so they don't ship to prod.
const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    );

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Suspense fallback={null}>
        <TanStackRouterDevtools />
      </Suspense>
    </>
  ),
});
