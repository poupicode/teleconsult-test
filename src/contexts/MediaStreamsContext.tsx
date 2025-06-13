import { createContext } from "react";
import { MediaStreamList } from "features/room/rtc/peer/models/types";

//type MediaStreamsContextType = [ MediaStreamListType, React.Dispatch<React.SetStateAction<MediaStreamListType>> ]
type MediaStreamsContextType = [ MediaStreamList, (value: MediaStreamList) => void ]
const MediaStreamsContext = createContext<MediaStreamsContextType>([{}, () => {}]);

export default MediaStreamsContext;
