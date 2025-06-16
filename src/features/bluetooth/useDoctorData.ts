import { useState, useEffect } from "react";
import { PeerConnection } from "@/features/room/rtc/peer/connection/peer-connection";
import { setMeasure } from "../measures/measureSlice";

interface UseDoctorDataOptions {
  dispatch: (action: any) => void;
  role: "practitioner" | "patient" | null;
  peerConnection?: PeerConnection | null;
}

// Hook principal utilisé pour recevoir et stocker les mesures
export function useDoctorData({ dispatch, role, peerConnection }: UseDoctorDataOptions) {
  // Fonction appelée automatiquement par le système WebRTC quand une mesure arrive
  const receiveData = (rawDataReceived: any) => {
    console.log("[Médecin] Payload reçu :", rawDataReceived);
    dispatch(setMeasure(rawDataReceived)); // on envoie au store Redux si nécessaire
  };

  useEffect(() => {
    if (role === "practitioner" && peerConnection?.isDataChannelAvailable()) {
      const manager = peerConnection.getDataChannelManager();
      manager.onMeasurement(receiveData);
    }
  }, [peerConnection, receiveData, role]);
}
