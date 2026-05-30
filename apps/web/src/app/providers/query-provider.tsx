import {QueryClientProvider} from "@tanstack/react-query";
import type {PropsWithChildren} from "react";
import {useState} from "react";
import {createQueryClient} from "@/shared/api/query-client";

export function PixelleQueryProvider({children}: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
