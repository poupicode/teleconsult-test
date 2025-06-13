export async function getVideoDevices() : Promise<MediaDeviceInfo[]> {
    let devices: MediaDeviceInfo[] = [];
    try {
        // Get Permission for video and audio
        await navigator.mediaDevices
            .getUserMedia({ video: true, audio: true });
        // Get all video devices
        devices = (await navigator.mediaDevices.enumerateDevices())
            .filter(device => device.kind === 'videoinput');

        console.debug("Found video devices", devices);
    } catch (err) {
        console.error("Error getting video devices", err);
    } finally {
        return devices;
    }
}

export async function getStreamFromVideoDeviceId(videoDeviceId: string) : Promise<MediaStream>{
    return navigator.mediaDevices.getUserMedia(
        { video: { deviceId: videoDeviceId }, audio: true }
    );
}