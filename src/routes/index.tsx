import { createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from 'convex/_generated/dataModel';

export const Route = createFileRoute('/')({
    component: Home,
})

const SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

function Home() {
    // --- STATE ---
    const [callId, setCallId] = useState<Id<"calls"> | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [status, setStatus] = useState("Idle");
    const [isCaller, setIsCaller] = useState(false);

    // --- REFS (Stable across renders) ---
    const pc = useRef<RTCPeerConnection | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const callInputRef = useRef<HTMLInputElement>(null);

    // Avoid processing the same candidates multiple times
    const processedCandidates = useRef<Set<string>>(new Set());

    // --- CONVEX HOOKS ---
    // This is the "Magic": React automatically re-runs when the DB changes
    const callData = useQuery(api.webrtc.getCall, { id: callId });

    const createCallMutation = useMutation(api.webrtc.createCall);
    const addOfferMutation = useMutation(api.webrtc.addOffer);
    const addAnswerMutation = useMutation(api.webrtc.addAnswer);
    const addOfferCandidateMutation = useMutation(api.webrtc.addOfferCandidate);
    const addAnswerCandidateMutation = useMutation(api.webrtc.addAnswerCandidate);

    // --- INITIALIZATION EFFECT ---
    useEffect(() => {
        // 1. Initialize Peer Connection
        pc.current = new RTCPeerConnection(SERVERS);

        // 2. Handle Remote Tracks
        pc.current.ontrack = (event) => {
            console.log("📥 Received remote track");
            const stream = event.streams[0];
            if (stream) {
                setRemoteStream(stream);
            }
        };

        // 3. Handle Connection State Changes
        pc.current.onconnectionstatechange = () => {
            setStatus(pc.current?.connectionState || "Unknown");
        };

        // Cleanup on unmount
        return () => {
            pc.current?.close();
            localStream?.getTracks().forEach(t => t.stop());
        };
    }, []);
    // ^ Empty dependency array = runs once on mount

    // --- SYNC UI VIDEO ELEMENTS ---
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [localStream, remoteStream]);


    // --- ICE CANDIDATE HANDLING ---
    // We need to define this dynamically based on whether we are caller/answerer
    // or simply check if we have a Call ID to send to.
    useEffect(() => {
        if (!pc.current || !callId) return;

        pc.current.onicecandidate = (event) => {
            if (event.candidate) {
                const candidateString = JSON.stringify(event.candidate.toJSON());
                if (isCaller) {
                    addOfferCandidateMutation({ id: callId, candidate: candidateString });
                } else {
                    addAnswerCandidateMutation({ id: callId, candidate: candidateString });
                }
            }
        };
    }, [callId, isCaller]);


    // --- SIGNALING LOOP (The "Brain") ---
    useEffect(() => {
        if (!pc.current || !callData) return;

        const syncSignaling = async () => {
            const connection = pc.current!;

            // 1. Handle Remote Offer (Answerer side)
            if (callData.offer && connection.signalingState === "stable" && !isCaller) {
                console.log("📝 Setting Remote Offer");
                const offer = new RTCSessionDescription(callData.offer as RTCSessionDescriptionInit);
                await connection.setRemoteDescription(offer);
                setStatus("Received Offer");
            }

            // 2. Handle Remote Answer (Caller side)
            if (callData.answer && connection.signalingState === "have-local-offer" && isCaller) {
                console.log("📝 Setting Remote Answer");
                const answer = new RTCSessionDescription(callData.answer as RTCSessionDescriptionInit);
                await connection.setRemoteDescription(answer);
                setStatus("Connected");
            }

            // 3. Handle Candidates (Trickle ICE)
            // If I am caller, I need answerCandidates. If I am answerer, I need offerCandidates.
            const newCandidates = isCaller ? callData.answerCandidates : callData.offerCandidates;

            for (const candidateString of newCandidates) {
                if (!processedCandidates.current.has(candidateString)) {
                    const candidateInit = JSON.parse(candidateString);
                    await connection.addIceCandidate(candidateInit);
                    processedCandidates.current.add(candidateString);
                    console.log("🧊 Added ICE Candidate");
                }
            }
        };

        syncSignaling();
    }, [callData, isCaller]);


    // --- USER ACTIONS ---

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);

            // Add tracks to PC
            stream.getTracks().forEach(track => {
                pc.current?.addTrack(track, stream);
            });
        } catch (err) {
            alert("Could not start webcam");
        }
    };

    const createCall = async () => {
        if (!localStream) return alert("Start webcam first");

        setIsCaller(true);
        const newCallId = await createCallMutation();
        setCallId(newCallId);

        // Create Offer
        const connection = pc.current!;
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        await addOfferMutation({
            id: newCallId,
            offer: { type: offer.type, sdp: offer.sdp! }
        });
    };

    const joinCall = () => {
        if (!localStream) return alert("Start webcam first");
        const inputId = callInputRef.current?.value.trim();
        if (!inputId) return alert("Enter Call ID");

        setIsCaller(false);
        setCallId(inputId as Id<"calls">);
        setStatus("Joining...");
    };

    const answerCall = async () => {
        if (!pc.current || !callId) return;

        const connection = pc.current;
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        await addAnswerMutation({
            id: callId,
            answer: { type: answer.type, sdp: answer.sdp! }
        });
    };

    const hangupCall = () => {
        pc.current?.close();
        setCallId(null);
        setIsCaller(false);
        setStatus("Disconnected");
    };

    return (
        <div className="p-8 max-w-4xl mx-auto font-sans">
            <h1 className="text-3xl font-bold mb-6">WebRTC + Convex</h1>

            <div className="mb-6 p-4 bg-gray-100 rounded flex justify-between items-center">
                <div>
                    <span className="font-bold text-gray-700">Status: </span>
                    <span className={`font-mono ${status === 'connected' ? 'text-green-600' : 'text-blue-600'}`}>
                        {status}
                    </span>
                </div>
                {callId && (
                    <div className="text-sm bg-white px-2 py-1 rounded border">
                        ID: {callId}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                {/* Local Video */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                        ref={localVideoRef}
                        autoPlay playsInline muted
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        You
                    </div>
                </div>

                {/* Remote Video */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                        ref={remoteVideoRef}
                        autoPlay playsInline
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Remote
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <section className="space-y-4">
                    <h3 className="font-bold text-lg">1. Setup</h3>
                    <button
                        onClick={startWebcam}
                        disabled={!!localStream}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        Start Webcam
                    </button>
                </section>

                <div className="border-t my-2"></div>

                <section className="space-y-4">
                    <h3 className="font-bold text-lg">2. Connect</h3>

                    <div className="flex gap-4 items-start">
                        {/* Caller Box */}
                        <div className="p-4 border rounded flex-1">
                            <h4 className="font-bold mb-2">Create New Call</h4>
                            <button
                                onClick={createCall}
                                disabled={!localStream || !!callId}
                                className="px-4 py-2 bg-green-600 text-white rounded w-full disabled:opacity-50"
                            >
                                Create Call ID
                            </button>
                        </div>

                        <div className="flex items-center h-32 font-bold text-gray-400">OR</div>

                        {/* Joiner Box */}
                        <div className="p-4 border rounded flex-1">
                            <h4 className="font-bold mb-2">Join Existing Call</h4>
                            <input
                                ref={callInputRef}
                                placeholder="Paste Call ID..."
                                className="w-full p-2 border rounded mb-2"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={joinCall}
                                    disabled={!localStream || !!callId}
                                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
                                >
                                    1. Join
                                </button>
                                <button
                                    onClick={answerCall}
                                    disabled={!callData?.offer || isCaller || !!callData?.answer}
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
                                >
                                    2. Answer
                                </button>
                                <button
                                    onClick={hangupCall}
                                    disabled={!callId}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                                >
                                    Hang Up
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}