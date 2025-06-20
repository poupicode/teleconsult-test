import PatientInformationsDisplay from "./PatientInformationsDisplay";
import VideoButton from "./VideoButton";
import { useEffect, useState } from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useAppSelector } from "@/hooks/useMediaStream";
import { VideoThumbnail } from "@/components/stream/VideoThumbnail";
import { VideoDeviceSelector } from "@/components/mediaDevices/VideoDeviceSelector";
import { RefreshDeviceButton } from "@/components/mediaDevices/RefreshDevicesButton";

type InformationsDetails = {
  name: string;
  first_name: string;
  birth_date?: string;
  gender?: "Homme" | "Femme";
  patient_number?: number;
  consultation_reason?: string;
  occupation?: string;
};

type InformationPanelProps = {
  patientInformations: InformationsDetails | null;
  userKind: "patient" | "practitioner" | null;
  setIsConsultationTab: (value: boolean) => void;
  handleOpenVideoPanel: () => void;
  connectionStatus: string;
  isInformationsPanelOpened: boolean;
};

const InformationsPanel = ({
  patientInformations,
  userKind,
  setIsConsultationTab,
  connectionStatus,
  handleOpenVideoPanel,
  isInformationsPanelOpened,
}: InformationPanelProps) => {
  const [areCrossedIcons, setAreCrossedIcons] = useState<
    Record<number, boolean>
  >({});

  const handleCrossIcon = (id: number) => {
    setAreCrossedIcons((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        delete updated[id];
      } else {
        updated[id] = true;
      }
      return updated;
    });
  };
  const streamIds = {
    localCamera: useAppSelector((state) => state.streams.local.camera?.streamId),
    localInstrument: useAppSelector((state) => state.streams.local.instrument?.streamId),
    remoteCamera: useAppSelector((state) => state.streams.remote.camera?.streamId),
    remoteInstrument: useAppSelector((state) => state.streams.remote.instrument?.streamId),
    selectedStream: useAppSelector((state) => state.selectedStream.streamId),
  };
  return (
    <Container
      className="position-absolute p-0"
      style={{
        width: isInformationsPanelOpened ? "65vw" : "0",
        right: "0",
        top: "-.8em",
        height: "calc(100% + 1.5em)",
        zIndex: "100",
        overflow: "hidden",
        transition: ".7s"
      }}
    >
      <div
        className="position-absolute h-100 bg-white-pink p-3"
        style={{
          width: "90%",
          right: "0",
          overflowY: "auto",
          filter: "drop-shadow(-3px 3px 10px rgba(0, 0, 0, 0.2))",
        }}
      >
        <h2 className="fs-5 text-center">Appel vidéo</h2>
        <hr />
        <Row className="w-100 mx-auto">
          <Col className="p-0" style={{ flex: "0 0 74.7%", maxWidth: "74.7%" }}>
            <div
              className="w-100 rounded-3"
              style={{ aspectRatio: "16/9", backgroundColor: "black" }}
            ></div>
          </Col>
          <Col
            className="p-0 ps-2"
            style={{ flex: "0 0 25.3%", maxWidth: "25.3%" }}
          >
            <div
              className="w-100 rounded-3 mb-1"
              style={{ aspectRatio: "16/9", backgroundColor: "black" }}
            ></div>
            <div
              className="w-100 rounded-3 mb-1"
              style={{ aspectRatio: "16/9", backgroundColor: "black" }}
            ></div>
            <div
              className="w-100 rounded-3"
              style={{ aspectRatio: "16/9", backgroundColor: "black" }}
            ></div>
          </Col>
        </Row>

        <div className="d-flex justify-content-between align-items-center mt-2">
          <p className="small">
            <small>Durée de l'appel : --:--</small>
          </p>
          <ul className="d-flex align-items-center">
            <li>
              <VideoButton>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19.9998 23.6367C22.0081 23.6367 23.6362 22.0086 23.6362 20.0003C23.6362 17.992 22.0081 16.364 19.9998 16.364C17.9915 16.364 16.3635 17.992 16.3635 20.0003C16.3635 22.0086 17.9915 23.6367 19.9998 23.6367Z"
                    stroke="#2A5867"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M28.9695 23.6367C28.8082 24.0023 28.76 24.4078 28.8313 24.801C28.9026 25.1942 29.0901 25.5571 29.3695 25.8427L29.4423 25.9155C29.6677 26.1406 29.8465 26.408 29.9685 26.7023C30.0905 26.9966 30.1533 27.312 30.1533 27.6306C30.1533 27.9492 30.0905 28.2647 29.9685 28.559C29.8465 28.8533 29.6677 29.1206 29.4423 29.3458C29.2171 29.5712 28.9497 29.75 28.6554 29.872C28.3612 29.994 28.0457 30.0568 27.7271 30.0568C27.4085 30.0568 27.0931 29.994 26.7988 29.872C26.5045 29.75 26.2371 29.5712 26.012 29.3458L25.9392 29.2731C25.6536 28.9936 25.2907 28.8062 24.8975 28.7349C24.5043 28.6636 24.0988 28.7117 23.7332 28.8731C23.3747 29.0267 23.0689 29.2818 22.8535 29.607C22.6382 29.9322 22.5226 30.3133 22.521 30.7034V30.9094C22.521 31.5524 22.2656 32.169 21.811 32.6236C21.3564 33.0782 20.7398 33.3337 20.0968 33.3337C19.4539 33.3337 18.8372 33.0782 18.3826 32.6236C17.928 32.169 17.6726 31.5524 17.6726 30.9094V30.8003C17.6632 30.3991 17.5333 30.01 17.2998 29.6836C17.0664 29.3572 16.7401 29.1085 16.3635 28.97C15.9979 28.8087 15.5923 28.7605 15.1991 28.8318C14.8059 28.9031 14.4431 29.0906 14.1574 29.37L14.0847 29.4427C13.8595 29.6681 13.5922 29.847 13.2979 29.969C13.0036 30.091 12.6881 30.1537 12.3695 30.1537C12.051 30.1537 11.7355 30.091 11.4412 29.969C11.1469 29.847 10.8795 29.6681 10.6544 29.4427C10.429 29.2176 10.2502 28.9502 10.1282 28.6559C10.0062 28.3616 9.94338 28.0462 9.94338 27.7276C9.94338 27.409 10.0062 27.0936 10.1282 26.7993C10.2502 26.505 10.429 26.2376 10.6544 26.0124L10.7271 25.9397C11.0065 25.654 11.194 25.2912 11.2653 24.898C11.3366 24.5048 11.2885 24.0993 11.1271 23.7337C10.9735 23.3751 10.7183 23.0694 10.3931 22.854C10.0679 22.6387 9.68685 22.5231 9.29681 22.5215H9.09075C8.4478 22.5215 7.83118 22.2661 7.37655 21.8115C6.92191 21.3569 6.6665 20.7402 6.6665 20.0973C6.6665 19.4543 6.92191 18.8377 7.37655 18.3831C7.83118 17.9285 8.4478 17.6731 9.09075 17.6731H9.19984C9.60104 17.6637 9.99015 17.5338 10.3166 17.3003C10.643 17.0669 10.8916 16.7406 11.0301 16.364C11.1915 15.9984 11.2396 15.5928 11.1683 15.1996C11.097 14.8064 10.9096 14.4436 10.6301 14.1579L10.5574 14.0852C10.332 13.86 10.1532 13.5927 10.0312 13.2984C9.90921 13.0041 9.84641 12.6886 9.84641 12.37C9.84641 12.0514 9.90921 11.736 10.0312 11.4417C10.1532 11.1474 10.332 10.88 10.5574 10.6549C10.7826 10.4295 11.0499 10.2507 11.3442 10.1287C11.6385 10.0067 11.954 9.94387 12.2726 9.94387C12.5911 9.94387 12.9066 10.0067 13.2009 10.1287C13.4952 10.2507 13.7626 10.4295 13.9877 10.6549L14.0604 10.7276C14.3461 11.007 14.7089 11.1945 15.1022 11.2658C15.4954 11.3371 15.9009 11.2889 16.2665 11.1276H16.3635C16.722 10.9739 17.0277 10.7188 17.2431 10.3936C17.4585 10.0684 17.574 9.68734 17.5756 9.2973V9.09123C17.5756 8.44829 17.831 7.83167 18.2856 7.37704C18.7403 6.9224 19.3569 6.66699 19.9998 6.66699C20.6428 6.66699 21.2594 6.9224 21.714 7.37704C22.1687 7.83167 22.4241 8.44829 22.4241 9.09123V9.20033C22.4256 9.59037 22.5412 9.97145 22.7566 10.2966C22.9719 10.6218 23.2777 10.877 23.6362 11.0306C24.0018 11.192 24.4073 11.2401 24.8005 11.1688C25.1938 11.0975 25.5566 10.9101 25.8423 10.6306L25.915 10.5579C26.1401 10.3325 26.4075 10.1537 26.7018 10.0317C26.9961 9.9097 27.3116 9.8469 27.6301 9.8469C27.9487 9.8469 28.2642 9.9097 28.5585 10.0317C28.8528 10.1537 29.1201 10.3325 29.3453 10.5579C29.5707 10.783 29.7495 11.0504 29.8715 11.3447C29.9935 11.639 30.0563 11.9545 30.0563 12.2731C30.0563 12.5916 29.9935 12.9071 29.8715 13.2014C29.7495 13.4957 29.5707 13.7631 29.3453 13.9882L29.2726 14.0609C28.9931 14.3466 28.8057 14.7094 28.7344 15.1026C28.6631 15.4958 28.7112 15.9014 28.8726 16.267V16.364C29.0262 16.7225 29.2813 17.0282 29.6065 17.2436C29.9317 17.459 30.3128 17.5745 30.7029 17.5761H30.9089C31.5519 17.5761 32.1685 17.8315 32.6231 18.2861C33.0778 18.7408 33.3332 19.3574 33.3332 20.0003C33.3332 20.6433 33.0778 21.2599 32.6231 21.7145C32.1685 22.1692 31.5519 22.4246 30.9089 22.4246H30.7998C30.4098 22.4261 30.0287 22.5417 29.7035 22.7571C29.3783 22.9724 29.1232 23.2782 28.9695 23.6367Z"
                    stroke="#2A5867"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </VideoButton>
            </li>
            <li>
              <VideoButton handleClick={() => handleCrossIcon(2)}>
                {areCrossedIcons[2] ? (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10 10L29.525 29.525M27.75 27.75H11.775C11.3042 27.75 10.8528 27.563 10.5199 27.2301C10.187 26.8972 10 26.4458 10 25.975V16.2125C10 15.7417 10.187 15.2903 10.5199 14.9574C10.8528 14.6245 11.3042 14.4375 11.775 14.4375H14.4375M17.1 11.775H22.425L24.2 14.4375H27.75C28.2208 14.4375 28.6722 14.6245 29.0051 14.9574C29.338 15.2903 29.525 15.7417 29.525 16.2125V24.5017M22.6735 22.6735C22.3789 23.104 21.9931 23.4643 21.5435 23.7287C21.0939 23.9932 20.5916 24.1553 20.0722 24.2035C19.5528 24.2518 19.0292 24.185 18.5386 24.0079C18.0479 23.8309 17.6023 23.5478 17.2335 23.179C16.8647 22.8102 16.5816 22.3646 16.4046 21.8739C16.2275 21.3833 16.1607 20.8597 16.209 20.3403C16.2572 19.8209 16.4193 19.3186 16.6838 18.869C16.9482 18.4194 17.3085 18.0336 17.739 17.739"
                      stroke="#2A5867"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M29.525 25.9754C29.525 26.4462 29.338 26.8976 29.0051 27.2305C28.6722 27.5634 28.2208 27.7504 27.75 27.7504H11.775C11.3042 27.7504 10.8528 27.5634 10.5199 27.2305C10.187 26.8976 10 26.4462 10 25.9754V16.2129C10 15.7421 10.187 15.2907 10.5199 14.9578C10.8528 14.6249 11.3042 14.4379 11.775 14.4379H15.325L17.1 11.7754H22.425L24.2 14.4379H27.75C28.2208 14.4379 28.6722 14.6249 29.0051 14.9578C29.338 15.2907 29.525 15.7421 29.525 16.2129V25.9754Z"
                      stroke="#2A5867"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M19.7625 24.2004C21.7231 24.2004 23.3125 22.611 23.3125 20.6504C23.3125 18.6898 21.7231 17.1004 19.7625 17.1004C17.8019 17.1004 16.2125 18.6898 16.2125 20.6504C16.2125 22.611 17.8019 24.2004 19.7625 24.2004Z"
                      stroke="#2A5867"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                )}
              </VideoButton>
            </li>
            <li>
              <VideoButton handleClick={() => handleCrossIcon(3)}>
                {areCrossedIcons[3] ? (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M27.2529 24.5674L25.465 22.7795C25.7527 22.3069 25.9685 21.8137 26.1124 21.2999C26.2562 20.7861 26.3281 20.2518 26.3281 19.6969H28.7942C28.7942 20.6012 28.6606 21.4592 28.3935 22.2709C28.1263 23.0827 27.7461 23.8482 27.2529 24.5674ZM23.6155 20.8683L16.4639 13.7167V12.2987C16.4639 11.2712 16.8235 10.3978 17.5428 9.67852C18.262 8.95925 19.1354 8.59961 20.163 8.59961C21.1905 8.59961 22.0639 8.95925 22.7832 9.67852C23.5024 10.3978 23.8621 11.2712 23.8621 12.2987V19.6969C23.8621 19.923 23.8364 20.1285 23.785 20.3135C23.7336 20.4984 23.6771 20.6834 23.6155 20.8683ZM18.9299 32.0273V28.2049C16.7927 27.9172 15.0253 26.9667 13.6279 25.3535C12.2304 23.7403 11.5317 21.8548 11.5317 19.6969H13.9978C13.9978 21.4026 14.5989 22.8566 15.8011 24.0588C17.0033 25.261 18.4573 25.8621 20.163 25.8621C20.8617 25.8621 21.5244 25.7542 22.1512 25.5385C22.778 25.3227 23.3483 25.0195 23.8621 24.6291L25.6192 26.3862C25.0232 26.8588 24.3707 27.2544 23.6617 27.573C22.9527 27.8915 22.1975 28.1021 21.396 28.2049V32.0273H18.9299ZM29.7806 34.0002L7.09277 11.3123L8.81902 9.58604L31.5069 32.2739L29.7806 34.0002Z"
                      fill="#2A5867"
                    />
                  </svg>
                ) : (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20.1635 23.396C19.136 23.396 18.2626 23.0364 17.5433 22.3171C16.824 21.5979 16.4644 20.7245 16.4644 19.6969V12.2987C16.4644 11.2712 16.824 10.3978 17.5433 9.67852C18.2626 8.95925 19.136 8.59961 20.1635 8.59961C21.191 8.59961 22.0644 8.95925 22.7837 9.67852C23.503 10.3978 23.8626 11.2712 23.8626 12.2987V19.6969C23.8626 20.7245 23.503 21.5979 22.7837 22.3171C22.0644 23.0364 21.191 23.396 20.1635 23.396ZM18.9304 32.0273V28.2357C16.7932 27.948 15.0258 26.9924 13.6284 25.3689C12.2309 23.7454 11.5322 21.8548 11.5322 19.6969H13.9983C13.9983 21.4026 14.5994 22.8566 15.8016 24.0588C17.0038 25.261 18.4578 25.8621 20.1635 25.8621C21.8692 25.8621 23.3231 25.261 24.5254 24.0588C25.7276 22.8566 26.3287 21.4026 26.3287 19.6969H28.7947C28.7947 21.8548 28.096 23.7454 26.6986 25.3689C25.3011 26.9924 23.5338 27.948 21.3965 28.2357V32.0273H18.9304Z"
                      fill="#2A5867"
                    />
                  </svg>
                )}
              </VideoButton>
            </li>
          </ul>
        </div>
        <h5>Caméra locale</h5>
  <VideoThumbnail
    streamid={streamIds.localCamera}
                        muted
                        autoPlay
                        style={{ maxWidth: "100%" }}
  />
  <VideoDeviceSelector deviceType="camera"></VideoDeviceSelector>

  <h5 className="mt-4">Caméra distante</h5>
  <VideoThumbnail
                        streamid={streamIds.remoteCamera}
                        autoPlay
                        style={{ maxWidth: "100%" }}
                      ></VideoThumbnail>

  <div className="mt-4">
    <RefreshDeviceButton />
  </div>
        {(userKind === "patient" || connectionStatus === "connected") && (
          <PatientInformationsDisplay
            patientInformations={patientInformations}
            userKind={userKind}
            setIsConsultationTab={setIsConsultationTab}
          />
        )}
      </div>
      <Button
        className="other-btn rounded-5 position-absolute p-0"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          left: ".8em",
          filter: "drop-shadow(-2px 2px 7px rgba(0, 0, 0, 0.2))"
        }}
        onClick={handleOpenVideoPanel}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M41.4139 38.603C42.1935 39.3768 42.1935 40.64 41.4139 41.4196C41.027 41.8065 40.5149 42 40.0027 42C39.4906 42 38.9899 41.8065 38.5973 41.4196L28.4972 31.3195L18.397 41.4196C17.6232 42.1935 16.36 42.1935 15.5804 41.4196C14.8065 40.64 14.8065 39.3768 15.5804 38.603L25.6805 28.5028L15.5804 18.4027C14.8065 17.6232 14.8065 16.36 15.5804 15.5861C15.9673 15.1935 16.4795 15 16.9916 15C17.5037 15 18.0101 15.1935 18.397 15.5861L28.4972 25.6862L38.5973 15.5861C39.3768 14.8065 40.6344 14.8065 41.4139 15.5861C41.8008 15.973 42 16.4795 42 16.9916C42 17.5037 41.8008 18.0158 41.4139 18.4027L31.3138 28.5028L41.4139 38.603Z"
            fill="#2A5867"
          />
        </svg>
      </Button>
    </Container>
  );
};
export default InformationsPanel;
