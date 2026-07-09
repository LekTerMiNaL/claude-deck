import { useRoute } from "./lib/router";
import { Dashboard } from "./pages/Dashboard";
import { SessionView } from "./pages/SessionView";
import { Timeline } from "./pages/Timeline";
import { Search } from "./pages/Search";

export function App() {
  const [route, navigate] = useRoute();

  if (route.pathname === "/project") {
    const path = route.query.get("path");
    if (path) {
      return <SessionView projectPath={path} initialSessionId={route.query.get("s")} navigate={navigate} />;
    }
  }
  if (route.pathname === "/timeline") {
    return <Timeline navigate={navigate} />;
  }
  if (route.pathname === "/search") {
    return <Search navigate={navigate} initialQuery={route.query.get("q") ?? ""} />;
  }
  return <Dashboard navigate={navigate} />;
}
