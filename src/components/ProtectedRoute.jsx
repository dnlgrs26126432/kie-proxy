import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const BG = "#07070E", MU = "#5A5A80";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG, color: MU, fontFamily: "Inter,sans-serif", fontSize: 13 }}>
        Caricamento...
      </div>
    );
  }

  if (!user) return <Navigate to="/?login=1" replace />;

  return children;
}
