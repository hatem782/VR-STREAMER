"use client";
// pages/desktop.js
import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";

const Desktop = () => {
  const [socket, setSocket] = useState<any>(null);
  const videoRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<any[]>([]); // Store ICE candidates before remote description is set

  useEffect(() => {
    // Establish socket connection to the signaling server
    const socketConnection = (io as any).connect("http://localhost:5000");
    setSocket(socketConnection);

    // Listen for WebRTC events from the mobile client
    socketConnection.on("answer", handleAnswer);
    socketConnection.on("ice-candidate", handleIceCandidate);

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  const handleAnswer = (answer: RTCSessionDescription) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.setRemoteDescription(answer).catch((error) => {
        console.error("Error setting remote description:", error);
      });
    }
  };

  const handleIceCandidate = (candidate: RTCIceCandidate) => {
    if (peerConnectionRef.current) {
      if (peerConnectionRef.current.remoteDescription) {
        // If remote description is set, add the ICE candidate immediately
        peerConnectionRef.current
          .addIceCandidate(candidate)
          .catch((error) =>
            console.error("Error adding ICE candidate:", error)
          );
      } else {
        // Store ICE candidate before remote description is set
        pendingCandidates.current.push(candidate);
      }
    }
  };

  const startScreenSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      videoRef.current.srcObject = stream;

      // Setup WebRTC peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }, // Google public STUN server
        ],
      });

      // Add the screen stream to the peer connection
      stream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));

      // When ICE candidates are found, send them to the mobile device
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", event.candidate);
        }
      };

      // Store the peer connection reference
      peerConnectionRef.current = peerConnection;

      // Create an offer and send it to the mobile device
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit("offer", offer);

      // Handle ICE candidates that might have been received earlier
      pendingCandidates.current.forEach((candidate) => {
        peerConnection
          .addIceCandidate(candidate)
          .catch((error) =>
            console.error("Error adding stored ICE candidate:", error)
          );
      });
      pendingCandidates.current = []; // Clear stored candidates after processing them
    } catch (error) {
      console.error("Error starting screen sharing:", error);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen flex-col">
      <h1>Desktop Screen Sharing</h1>
      <button
        className="bg-red-500 text-white p-2"
        onClick={startScreenSharing}
      >
        Start Screen Sharing
      </button>

      <video ref={videoRef} autoPlay playsInline muted></video>
    </div>
  );
};

export default Desktop;
