import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Le technicien partage l'interface du gestionnaire (ManagerLayout filtre déjà les sections selon
// les permissions) : il n'a pas d'espace séparé à maintenir.
const isStaff = (role) => role === "manager" || role === "technicien";

export function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }
  if (!user) {
    return <Navigate to={role === "manager" ? "/admin-login" : "/select"} replace />;
  }
  if (role === "manager" ? !isStaff(user.role) : user.role !== role) {
    return <Navigate to={isStaff(user.role) ? "/manager" : "/"} replace />;
  }
  return children;
}
