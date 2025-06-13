import { createContext } from "react";
import { VideoDevicesType } from "features/room/rtc/peer/models/types";

type VideoDevicesContextType = [ VideoDevicesType, React.Dispatch<React.SetStateAction<VideoDevicesType>> ]
export const VideoDevicesContext = createContext<VideoDevicesContextType>([[], () => {}]);

export default VideoDevicesContext;
