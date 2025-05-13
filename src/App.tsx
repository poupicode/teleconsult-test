import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import React from "react";
import AppNavbar from "./components/Navbar";
import ErrorPage from "./pages/ErrorPage";

function App() {
  return (
    <BrowserRouter>
    <AppNavbar />
      <Routes>
        <Route path="/error" element={<ErrorPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;