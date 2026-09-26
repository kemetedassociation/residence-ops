import { Routes, Route } from "react-router-dom";
import { ResidentLayout } from "./layouts/ResidentLayout";
import { ManagerLayout } from "./layouts/ManagerLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CookieBanner } from "./components/CookieBanner";
import { Chatbot } from "./components/Chatbot";
import { PrivacyPolicy } from "./pages/legal/PrivacyPolicy";
import { Terms } from "./pages/legal/Terms";

import { Feed } from "./pages/resident/Feed";
import { Select } from "./pages/resident/Select";
import { AdminLogin } from "./pages/resident/AdminLogin";
import { ResidentSignup } from "./pages/resident/ResidentSignup";
import { Download } from "./pages/resident/Download";
import { ForgotPassword } from "./pages/resident/ForgotPassword";
import { ResetPassword } from "./pages/resident/ResetPassword";
import { Report } from "./pages/resident/Report";
import { MapView } from "./pages/resident/MapView";
import { News } from "./pages/resident/News";
import { Suggestions } from "./pages/resident/Suggestions";
import { Profile } from "./pages/resident/Profile";
import { ResidentCard } from "./pages/resident/Card";
import { Restaurant } from "./pages/resident/Restaurant";
import { Administration } from "./pages/resident/Administration";
import { Leisure } from "./pages/resident/Leisure";

import { Dashboard } from "./pages/manager/Dashboard";
import { IncidentsList } from "./pages/manager/IncidentsList";
import { Planning } from "./pages/manager/Planning";
import { Analytics } from "./pages/manager/Analytics";
import { NewsManager } from "./pages/manager/NewsManager";
import { UsersDirectory } from "./pages/manager/UsersDirectory";
import { ErrorLog } from "./pages/manager/ErrorLog";
import { PaymentSettings } from "./pages/manager/PaymentSettings";
import { Notifications } from "./pages/resident/Notifications";
import { CareProfessionals } from "./pages/manager/CareProfessionals";
import { Help } from "./pages/resident/Help";
import { PsyPortal } from "./pages/psy/PsyPortal";
import { Settings } from "./pages/manager/Settings";
import { MenuManager } from "./pages/manager/MenuManager";
import { DocumentRequests } from "./pages/manager/DocumentRequests";
import { Availabilities } from "./pages/manager/Availabilities";
import { ActivitiesManager } from "./pages/manager/ActivitiesManager";

export default function App() {
  return (
    <>
      <Routes>
      {/* Public / onboarding */}
      <Route path="/select" element={<Select />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/inscription-resident" element={<ResidentSignup />} />
      <Route path="/telecharger" element={<Download />} />
      <Route path="/aide" element={<Help />} />
      <Route path="/psy" element={<PsyPortal />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
      <Route path="/confidentialite" element={<PrivacyPolicy />} />
      <Route path="/conditions" element={<Terms />} />

      {/* Resident app */}
      <Route element={<ResidentLayout />}>
        <Route
          path="/"
          element={
            <ProtectedRoute role="resident">
              <Feed />
            </ProtectedRoute>
          }
        />
        <Route
          path="/signaler"
          element={
            <ProtectedRoute role="resident">
              <Report />
            </ProtectedRoute>
          }
        />
        <Route
          path="/carte"
          element={
            <ProtectedRoute role="resident">
              <MapView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute role="resident">
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/actualites"
          element={
            <ProtectedRoute role="resident">
              <News />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suggestions"
          element={
            <ProtectedRoute role="resident">
              <Suggestions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profil"
          element={
            <ProtectedRoute role="resident">
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ma-carte"
          element={
            <ProtectedRoute role="resident">
              <ResidentCard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant"
          element={
            <ProtectedRoute role="resident">
              <Restaurant />
            </ProtectedRoute>
          }
        />
        <Route
          path="/administration"
          element={
            <ProtectedRoute role="resident">
              <Administration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loisirs"
          element={
            <ProtectedRoute role="resident">
              <Leisure />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Manager app */}
      <Route element={<ManagerLayout />}>
        <Route
          path="/manager"
          element={
            <ProtectedRoute role="manager">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/incidents"
          element={
            <ProtectedRoute role="manager">
              <IncidentsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/planning"
          element={
            <ProtectedRoute role="manager">
              <Planning />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/analytics"
          element={
            <ProtectedRoute role="manager">
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/actualites"
          element={
            <ProtectedRoute role="manager">
              <NewsManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/utilisateurs"
          element={
            <ProtectedRoute role="manager">
              <UsersDirectory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/accompagnement"
          element={
            <ProtectedRoute role="manager">
              <CareProfessionals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/notifications"
          element={
            <ProtectedRoute role="manager">
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/paiements"
          element={
            <ProtectedRoute role="manager">
              <PaymentSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/erreurs"
          element={
            <ProtectedRoute role="manager">
              <ErrorLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/parametres"
          element={
            <ProtectedRoute role="manager">
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/restaurant"
          element={
            <ProtectedRoute role="manager">
              <MenuManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/documents"
          element={
            <ProtectedRoute role="manager">
              <DocumentRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/rendez-vous"
          element={
            <ProtectedRoute role="manager">
              <Availabilities />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/loisirs"
          element={
            <ProtectedRoute role="manager">
              <ActivitiesManager />
            </ProtectedRoute>
          }
        />
      </Route>
      </Routes>
      <CookieBanner />
      <Chatbot />
    </>
  );
}
