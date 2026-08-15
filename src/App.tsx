import { AuthProviderComponent, useAuth } from "./lib/auth/AuthContext";
import { StoreProvider } from "./lib/store";
import AppShell from "./components/AppShell";
import AuthScreen from "./components/AuthScreen";
import Titlebar from "./components/Titlebar";
import { CompletionHost } from "./components/CompletionHost";
import { ListModalHost } from "./components/ListModalHost";
import { TaskModalHost } from "./components/TaskModalHost";
import { UpdaterHost } from "./components/UpdaterHost";

function Gate() {
  const { account, ready } = useAuth();
  if (!ready) return <div className="boot">Loading…</div>;
  if (!account) return <AuthScreen />;
  return (
    <StoreProvider>
      <CompletionHost>
        <TaskModalHost>
          <ListModalHost>
            <AppShell />
          </ListModalHost>
        </TaskModalHost>
      </CompletionHost>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <AuthProviderComponent>
      <div className="window">
        <Titlebar />
        <UpdaterHost>
          <Gate />
        </UpdaterHost>
      </div>
    </AuthProviderComponent>
  );
}
