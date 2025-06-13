// import the select component from bootstrap react
import { useContext } from 'react';
import { Form } from 'react-bootstrap';
import { useRef, useEffect } from 'react';
import { VideoDevicesContext } from "@/contexts/VideoDevicesContext";
import { getStreamFromVideoDeviceId, getVideoDevices } from "./VideoDeviceHelper";

// redux
import { useAppDispatch } from '@/hooks/useMediaStream';
import { streamUpdated, StreamsByDevice, StreamsState } from '@/features/streams/streamSlice';
import MediaStreamsContext from '@/contexts/MediaStreamsContext';
import { MediaStreamList } from '@/features/room/rtc/peer/models/types';
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
      //console.debug(selectElement.current.selectedIndex,selectElement.current.options.item(selectElement.current.selectedIndex)?.value);
      const newStream = await getStreamFromVideoDeviceId(selectElement.current.value);

      // Add the stream to mediaStreams context
      let newStreams: MediaStreamList = mediaStreams;
      newStreams[newStream.id as string] = newStream;
      setMediaStreams(newStreams)

      // Replace the corresponding stream in the store
      const newStreamDetails = {
        origin: "local" as keyof StreamsState,
        deviceType: props.deviceType,
        streamDetails: {
          streamId: newStream.id
        }
      }

      dispatch(streamUpdated(newStreamDetails))

    } else {
      console.error("No video device selected. Not getting stream");
    }
  }
}