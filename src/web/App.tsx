import { useRoute } from "./lib/router";
import { Dashboard } from "./pages/Dashboard";
import { SessionView } from "./pages/SessionView";

export function App() {
  const [route, navigate] = useRoute();

  if (route.pathname === "/project") {
    const path = route.query.get("path");
    if (path) {
      return <SessionView projectPath={path} initialSessionId={route.query.get("s")} navigate={navigate} />;
    }
  }
  return <Dashboard navigate={navigate} />;
}
