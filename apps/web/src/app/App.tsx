import {AppProviders} from "@/app/providers/app-providers";
import {AppRoutes} from "@/app/router/routes";

export function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
