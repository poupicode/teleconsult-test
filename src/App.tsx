import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import React from "react";
import AppNavbar from "./components/Navbar";
import ErrorPage from "./pages/ErrorPage";
import { ProtectedRoute, PublicOnlyRoute } from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import ConsultationPage from "./pages/ConsultationPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppNavbar />
        <Routes>
          {/* Routes accessibles uniquement aux utilisateurs NON connectés */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<AuthPage />} />
          </Route>

          {/* Routes accessibles uniquement aux utilisateurs connectés */}
          <Route element={<ProtectedRoute />}>
            <Route path="/consultation" element={<ConsultationPage />} />
          </Route>

          {/* Routes publiques */}
          <Route path="/error" element={<ErrorPage />} />
          <Route path="/" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;