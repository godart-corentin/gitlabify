import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ErrorFallback, Sentry } from "../../shared/lib/sentry";

const QUERY_CACHE_TAG = "query-cache";
const MUTATION_CACHE_TAG = "mutation-cache";

const handleQueryError = (error: unknown): void => {
  Sentry.captureException(error, { tags: { layer: QUERY_CACHE_TAG } });
};

const handleMutationError = (error: unknown): void => {
  Sentry.captureException(error, { tags: { layer: MUTATION_CACHE_TAG } });
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleQueryError }),
  mutationCache: new MutationCache({ onError: handleMutationError }),
});

const renderErrorFallback = ({ error }: { error: unknown }) => <ErrorFallback error={error} />;

type AppProvidersProps = {
  children: ReactNode;
};

export const AppProviders = ({ children }: AppProvidersProps) => (
  <Sentry.ErrorBoundary fallback={renderErrorFallback}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </Sentry.ErrorBoundary>
);
