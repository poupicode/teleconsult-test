import React, { useRef, useState } from "react";
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
import { MediaStreamList, VideoDevicesType } from "./features/room/rtc/peer/models/types";
import VideoDevicesContext from "./contexts/VideoDevicesContext";

function App() {
  //const [session, setSession] = useState({} as Session | null);
  // context
  const [videoDevices, setVideoDevices] = useState<VideoDevicesType>([]);
  const [mediaStreams, setMediaStreams] = useState<MediaStreamList>({});
  //const [mediaStreams, setMediaStreams] = useState<MediaStreamListType>({});

  //#region MediaStreamsContext

  /* TO AVOID RACE CONDITION, USE REF TO UPDATE STATE VARIABLE */
  // Reference the state variable to be able to update it from the context
  const _mediaStreams = useRef(mediaStreams);
  // Custom function to update the state variable by making sure the ref is updated as well
  const addMediaStreams = (value: MediaStreamList) => {
    // Update the ref with the new value
    _mediaStreams.current = { ..._mediaStreams.current, ...value };
    // Set the state with the new value
    setMediaStreams(_mediaStreams.current);
  };

  return (
    <AuthProvider>
      <MediaStreamsContext.Provider value={[mediaStreams, addMediaStreams]}>
        <VideoDevicesContext.Provider
              value={[videoDevices, setVideoDevices]}
            >
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
        </VideoDevicesContext.Provider>
      </MediaStreamsContext.Provider>
    </AuthProvider>
  );
}

export default App;
