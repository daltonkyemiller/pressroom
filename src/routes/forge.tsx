import { createFileRoute } from "@tanstack/react-router";
import ForgeApp from "@/components/forge/forge-app";

export const Route = createFileRoute("/forge")({
  component: ForgeApp,
});
