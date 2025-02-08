"use client";
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import * as THREE from "three";

const Mobile = () => {
  const [stream, setStream] = useState<any>(null);
  const videoRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<any[]>([]); // Store ICE candidates until remote description is set
  const socketRef = useRef<any>(null); // Store socket reference

  useEffect(() => {
    // Initialize socket connection
    const socketConnection = io("http://localhost:5000");
    socketRef.current = socketConnection;

    // Listen for WebRTC events
    socketConnection.on("offer", handleOffer);
    socketConnection.on("ice-candidate", handleIceCandidate);
    socketConnection.on("answer", handleAnswer);

    // Clean up socket on unmount
    return () => {
      socketConnection.disconnect();
    };
  }, []);

  const handleOffer = async (offer: any) => {
    try {
      console.log("Received WebRTC offer:", offer);

      peerConnectionRef.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      const peerConnection = peerConnectionRef.current;

      // Set up the peer connection for receiving video
      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        console.log("Received remote stream:", remoteStream);

        setStream(remoteStream);

        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play(); // Ensure video playback
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log("Sending ICE candidate:", event.candidate);
          socketRef.current.emit("ice-candidate", event.candidate);
        }
      };

      // Step 1: Set the remote description (offer)
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      // Step 2: Process any pending ICE candidates
      pendingCandidates.current.forEach((candidate) => {
        console.log("Processing stored ICE candidate:", candidate);
        peerConnection
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch((error) =>
            console.error("Error adding stored ICE candidate:", error)
          );
      });
      pendingCandidates.current = []; // Clear pending candidates after processing them

      // Step 3: Create an answer and send it back to the desktop
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (socketRef.current) {
        console.log("Sending WebRTC answer:", answer);
        socketRef.current.emit("answer", answer);
      }
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  };

  const handleIceCandidate = (candidate: any) => {
    console.log("Received ICE candidate:", candidate);

    if (peerConnectionRef.current) {
      if (peerConnectionRef.current.remoteDescription) {
        // If remote description is set, add the ICE candidate immediately
        console.log("Adding ICE candidate:", candidate);
        peerConnectionRef.current
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch((error) =>
            console.error("Error adding ICE candidate:", error)
          );
      } else {
        // Store ICE candidate before remote description is set
        console.warn(
          "Storing ICE candidate before remote description is set",
          candidate
        );
        pendingCandidates.current.push(candidate);
      }
    }
  };

  const handleAnswer = (answer: RTCSessionDescription) => {
    if (peerConnectionRef.current) {
      console.log("Received and setting remote answer:", answer);
      // Set remote description only if it's in the right state
      if (peerConnectionRef.current.signalingState === "have-local-offer") {
        peerConnectionRef.current
          .setRemoteDescription(answer)
          .catch((error) => {
            console.error("Error setting remote description:", error);
          });
      } else {
        console.warn(
          "Unexpected signaling state, cannot set remote description now."
        );
      }
    }
  };

  useEffect(() => {
    if (
      stream &&
      sceneRef.current &&
      cameraRef.current &&
      rendererRef.current
    ) {
      // Initialize Three.js scene and render the video in VR
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.body.appendChild(renderer.domElement);

      // Create a plane geometry for the video texture
      const videoTexture = new THREE.VideoTexture(videoRef.current);
      const geometry = new THREE.PlaneGeometry(10, 10);
      const material = new THREE.MeshBasicMaterial({ map: videoTexture });
      const plane = new THREE.Mesh(geometry, material);
      scene.add(plane);

      camera.position.z = 20;

      // Animate the scene to make it responsive
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };

      animate();
      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
    }
  }, [stream]);

  return (
    <div>
      <h1>Mobile VR Screen</h1>
      <video ref={videoRef} autoPlay controls />
    </div>
  );
};

export default Mobile;
