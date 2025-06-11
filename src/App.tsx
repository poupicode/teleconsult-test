import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import AppNavbar from "./components/Navbar";
import ErrorPage from "./pages/ErrorPage";
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import ConsultationPage from "./pages/ConsultationPage";
import ModifyAccountPage from "./pages/ModifyAccountPage";
import BackgroundPattern from "./components/BackgroundPattern";
import MediaStreamsContext from "./contexts/MediaStreamsContext"; // 👈

function App() {
  const [mediaStreams, setMediaStreams] = useState({}); // 👈 ajoute le state

  return (
    <AuthProvider>
      <MediaStreamsContext.Provider value={[mediaStreams, setMediaStreams]}> {/* 👈 wrap ici */}
        <BrowserRouter>
          <BackgroundPattern />
          <AppNavbar />
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<AuthPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/consultation" element={<ConsultationPage />} />
              <Route path="/modify-account" element={<ModifyAccountPage />} />
            </Route>
            <Route path="/error" element={<ErrorPage />} />
            <Route path="/" element={<HomePage />} />
          </Routes>
        </BrowserRouter>
      </MediaStreamsContext.Provider>
    </AuthProvider>
  );
}

export default App;
