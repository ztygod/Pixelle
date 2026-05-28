import type {PropsWithChildren} from "react";
import {PixelleEventProvider} from "@/app/providers/event-provider";
import {PixelleQueryProvider} from "@/app/providers/query-provider";

export function AppProviders({children}: PropsWithChildren) {
  return (
    <PixelleQueryProvider>
      <PixelleEventProvider>{children}</PixelleEventProvider>
    </PixelleQueryProvider>
  );
}
