// import the select component from bootstrap react
import { useContext } from 'react';
import { Form } from 'react-bootstrap';
import { useRef, useEffect } from 'react';
import { VideoDevicesContext } from "@/contexts/VideoDevicesContext";
import { getStreamFromVideoDeviceId, getVideoDevices } from "./videoDeviceHelper";

// redux
import { useAppDispatch } from '@/hooks/useMediaStream';
import { streamUpdated, StreamsByDevice, StreamsState } from '@/features/streams/streamSlice';
import MediaStreamsContext from '@/contexts/MediaStreamsContext';
import { MediaStreamList } from '@/features/room/rtc/peer/models/types';
import { store } from '@/app/store';
//import { mediaDevicesListUpdated_Async } from 'actions/media-devices';

export function VideoDeviceSelector(props: { deviceType: keyof StreamsByDevice }) {
  const dispatch = useAppDispatch();

  //context
  const [mediaDevices, setVideoDevices] = useContext(VideoDevicesContext);
  const [mediaStreams, setMediaStreams] = useContext(MediaStreamsContext);

  const selectElement = useRef<HTMLSelectElement>(null);
  //const [localStreams, setLocalStreams] = useContext(LocalStreamsContext);

  const elementDescription = `Local ${props.deviceType}`

  // Mounting component. Selecting the first video device by default.
  useEffect(() => {
    getVideoDevices().then(async devices => {
      setVideoDevices(devices);

      // Select the first video device by default
      handleChange();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <>
      <Form.Select ref={selectElement} onChange={handleChange}>
        {
          mediaDevices.map(videoDevice => {
            return (
              <option key={videoDevice.deviceId} value={videoDevice.deviceId}>
                {videoDevice.label}
              </option>
            );
          })
        }
      </Form.Select>
    </>
  );

  async function handleChange() {
    console.debug(`Video Selector Change (${elementDescription})`, " - Select Element: ", selectElement.current, " - Select Element Value: ", selectElement.current?.value);

    if (selectElement.current /*&& selectElement.current.value*/) {
      if (selectElement.current.selectedIndex < 0)
        selectElement.current.selectedIndex = 0;
      
      try {
        // Arrêter l'ancien stream si présent
        // Rechercher l'ancien stream associé à ce device type
        const oldStream = Object.values(mediaStreams).find(stream => {
          if (!stream) return false;
          // Vérifier dans le store si ce stream correspond au device type actuel
          const streamEntry = Object.values(store.getState().streams.local || {})
            .find(s => s.deviceType === props.deviceType && s.streamDetails?.streamId === stream.id);
          return !!streamEntry;
        });
        
        if (oldStream) {
          console.debug(`Stopping previous stream for ${props.deviceType}`);
          oldStream.getTracks().forEach(track => track.stop());
        }

        const newStream = await getStreamFromVideoDeviceId(selectElement.current.value);

        // Add the stream to mediaStreams context
        // Créer une nouvelle copie de l'objet pour que React détecte le changement
        const newStreams: MediaStreamList = { ...mediaStreams, [newStream.id]: newStream };
        setMediaStreams(newStreams);

        // Replace the corresponding stream in the store
        const newStreamDetails = {
          origin: "local" as keyof StreamsState,
          deviceType: props.deviceType,
          streamDetails: {
            streamId: newStream.id
          }
        }

        dispatch(streamUpdated(newStreamDetails));
      } catch (err) {
        console.error(`Erreur lors du changement d'appareil vidéo pour ${props.deviceType}:`, err);
        // Informer l'utilisateur de l'erreur
        alert(`Impossible d'accéder à la caméra. Veuillez vérifier les permissions.`);
      }
    } else {
      console.error("No video device selected. Not getting stream");
    }
  }
}