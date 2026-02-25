import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/layout";
import { ProjectModal, DeleteTableModal, TruncateTableModal, ExportTableModal, HelpModal, SchemaInfoModal, DeleteProjectModal, DropSchemaModal, ExportConnectionsModal, ImportConnectionsModal, DiscoveryModal } from "./components/modals";
import { CommandPalette, ProjectSpotlight, Toast } from "./components/ui";
import { OnboardingPage } from "./components/OnboardingOverlay";
import { useOnboardingStore } from "./stores";
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
  const { hasCompletedOnboarding } = useOnboardingStore();

  if (!hasCompletedOnboarding) {
    return <OnboardingPage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
      <ProjectModal />
      <DeleteTableModal />
      <TruncateTableModal />
      <ExportTableModal />
      <HelpModal />
      <SchemaInfoModal />
      <DeleteProjectModal />
      <DropSchemaModal />
      <ExportConnectionsModal />
      <ImportConnectionsModal />
      <DiscoveryModal />
      <CommandPalette />
      <ProjectSpotlight />
      <Toast />
    </QueryClientProvider>
  );
}

export default App;
