import { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
const VideoButton = ({
  children,
  handleClick
}: {
  children: React.ReactNode;
  handleClick?: () => void;
}) => {
  return (
    <Button
      className="secondary-btn p-0 ms-1"
      size="sm"
      onClick={handleClick}
    >
      {children}
    </Button>
  );
};
export default VideoButton;
