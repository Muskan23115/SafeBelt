import { Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import LiveMonitor from "./pages/LiveMonitor";
import ViolationsLog from "./pages/ViolationsLog";
import Stats from "./pages/Stats";

export default function App() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/"            element={<LiveMonitor />} />
          <Route path="/violations"  element={<ViolationsLog />} />
          <Route path="/stats"       element={<Stats />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
