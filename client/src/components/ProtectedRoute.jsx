import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }
  if (!user) {
    return <Navigate to={role === "manager" ? "/admin-login" : "/select"} replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to={user.role === "manager" ? "/manager" : "/"} replace />;
  }
  return children;
}
