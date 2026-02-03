import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/layout";
import { ProjectModal, StagedChangesModal } from "./components/modals";
import { CommandPalette } from "./components/ui";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
      <ProjectModal />
      <StagedChangesModal />
      <CommandPalette />
    </QueryClientProvider>
  );
}

export default App;
