import { useRef, useContext, useEffect } from "react";
import { useDispatch } from "react-redux";
import MediaStreamsContext from "@/contexts/MediaStreamsContext";
import { selectedStreamUpdated } from "@/features/streams/selected-stream-slice";
import { useAppSelector } from "@/hooks/useMediaStream";

interface VideoThumbnailProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  streamid?: string;
}

export function VideoThumbnail(props: VideoThumbnailProps) {
  const dispatch = useDispatch();
  const selectedStream = useAppSelector((state) => state.selectedStream.streamId);
  const [mediaStreams] = useContext(MediaStreamsContext);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { streamid, ...restProps } = props;

  useEffect(() => {
    if (!streamid || !mediaStreams[streamid]) return;

    const stream = mediaStreams[streamid];
    if (videoRef.current) {
      videoRef.current.srcObject = stream;

      if (!selectedStream) {
        dispatch(selectedStreamUpdated(stream.id));
      }
    }
  }, [streamid, mediaStreams, selectedStream, dispatch]);

  const handleClick = () => {
    if (streamid) {
      dispatch(selectedStreamUpdated(streamid));
    }
  };

  return (
    <video
      ref={videoRef}
      onClick={handleClick}
      autoPlay
      muted={props.muted ?? false}
      style={{ maxWidth: "100%", ...(props.style || {}) }}
      {...restProps}
    />
  );
}
