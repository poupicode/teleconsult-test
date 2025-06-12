import { useRef, useContext, useEffect } from "react";
// Redux store
import { useDispatch } from "react-redux";
import { store } from "app/store";
import MediaStreamsContext from "@/contexts/MediaStreamsContext";
import { selectedStreamUpdated } from "@/features/streams/selected-stream-slice";
import { useAppSelector } from "@/hooks/useMediaStream";

interface VideoThumbnailProps
  extends React.DetailedHTMLProps<
    React.VideoHTMLAttributes<HTMLVideoElement>,
    HTMLVideoElement
  > {
  stream?: MediaStream | null;
  streamid?: string;
}

const DefaultVideoThumbnailProps: VideoThumbnailProps = {
  streamid: "",
  muted: false,
  controls: false,
  autoPlay: true,
  style: { maxWidth: "100%" },
};

export function VideoThumbnail(props: VideoThumbnailProps) {
  const dispatch = useDispatch();

  const selectedStream = useAppSelector((state) => state.selectedStream.streamId);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mediaStreams] = useContext(MediaStreamsContext);
  console.log("[VideoThumbnail] 🔍 mediaStreams context:", mediaStreams);

  const videoElementRef = useRef<HTMLVideoElement>(null);

  let videoProps = { ...DefaultVideoThumbnailProps, ...props };

  useEffect(() => {
    if (videoElementRef.current && videoProps.streamid) {
      videoElementRef.current.srcObject = mediaStreams[videoProps.streamid]
    }
  }, [mediaStreams, videoProps.streamid])


  useEffect(() => {
    // function setStream() {
    if (videoElementRef.current && videoProps.streamid) {
      console.debug(`VideoThumbnail, streamId: ${videoProps.streamid}`);

      let newStream: MediaStream | null;

      newStream = mediaStreams[videoProps.streamid];

      videoElementRef.current.srcObject = newStream;

      // If there is no selected stream, set it
      // DIRTY, NEED TO FIND ANOTHER WAY TO DO THIS
      if (!selectedStream && newStream) dispatch(selectedStreamUpdated(newStream.id));

    } else {
      console.error("VideoThumbnail, cannot set stream");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoProps.streamid]);

  function handleClick() {
    if (videoElementRef.current && videoProps.streamid) {
      console.debug("Clicked video element");
      dispatch(selectedStreamUpdated(videoProps.streamid));
      //setSelectedStream(videoProps.streamid);
    }
  }


  return (
    <video
      className="hover-pointer"
      ref={videoElementRef}
      {...videoProps}
      onClick={handleClick}
    />
  );
}
