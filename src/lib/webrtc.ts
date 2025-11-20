import { api } from "convex/_generated/api";
import { Triggers } from "convex-helpers/server/triggers";
import { ConvexHttpClient } from "convex/browser";
import type { Id } from "node_modules/convex/dist/esm-types/values/value";
import type { DataModel } from "convex/_generated/dataModel";

const triggers = new Triggers<DataModel>();

// Initialize Convex client
const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

const servers = {
    iceServers: [
        {
            urls: ['stun:stun.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        },
    ],
    iceCandidatePoolSize: 10,
}

const peerConnection: RTCPeerConnection = new RTCPeerConnection(servers);
let localStream: MediaStream;
let remoteStream: MediaStream;

const webcamVideo = document.getElementById('webcamVideo') as HTMLVideoElement;
const webcamButton = document.getElementById('webcamButton') as HTMLButtonElement;
const callButton = document.getElementById('callButton') as HTMLButtonElement;
const callInput = document.getElementById('callInput') as HTMLInputElement;
const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
const answerButton = document.getElementById('answerButton') as HTMLButtonElement;
const hangupButton = document.getElementById('hangupButton') as HTMLButtonElement;

webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    remoteStream = new MediaStream();

    // Push tracks from local stream to peer connection
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    // Pull tracks from remote stream, add to video stream
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };

    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    callButton.disabled = false;
    answerButton.disabled = false;
    webcamButton.disabled = true;
};

callButton.onclick = async () => {
    // Create a new callDocument in Convex
    const callDocumentId = await convex.mutation(api.webrtc.createCall);

    // Get candidates for caller, save to callDocument
    peerConnection.onicecandidate = async (event) => {
        event.candidate && await convex.mutation(api.webrtc.addOfferCandidate,
            {
                id: callDocumentId,
                candidate: [event.candidate]
            }
        )
    };

    // Create offer
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp ?? null,
        type: offerDescription.type,
    };

    // Save offer to callDocument
    await convex.mutation(api.webrtc.addOffer, {
        id: callDocumentId,
        offer: offer
    });

    // Listen for remote answer
    triggers.register("calls", async () => {
        try {
            const callDocument = await convex.query(api.webrtc.getCallDocumentById, { id: callDocumentId });

            const answerDescription = callDocument?.answer;
            if (!answerDescription) return;

            const rtcAnswerDescription = new RTCSessionDescription({
                type: answerDescription.type as RTCSdpType,
                sdp: answerDescription.sdp ?? undefined,
            });
            await peerConnection.setRemoteDescription(rtcAnswerDescription);
        } catch (err) {
            console.error("Error setting remote description:", err);
        }
    });

    // When answered, add candidate to peer connection
    triggers.register("calls", async () => {
        const callDocument = await convex.query(api.webrtc.getCallDocumentById, { id: callDocumentId });
        const answerCandidates = callDocument?.answerCandidates || [];

        const rtcCandidates = answerCandidates.map(c => c && ({
            candidate: c.candidate ?? undefined,
            sdpMid: c.sdpMid ?? undefined,
            sdpMLineIndex: c.sdpMLineIndex ?? undefined,
            usernameFragment: c.usernameFragment ?? undefined,
        }));

        await Promise.all(rtcCandidates.map(c => c && peerConnection.addIceCandidate(new RTCIceCandidate(c))));
    });



    hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
// TODO: Connect to Convex 
answerButton.onclick = async () => {
    const callId = callInput.value as Id<"calls">;
    const callDocument = await convex.query(api.webrtc.getCallDocumentById, { id: callId });

    peerConnection.onicecandidate = async (event) => {
        event.candidate && await convex.mutation(api.webrtc.addAnswerCandidate,
            {
                id: callId,
                candidate: [event.candidate]
            }
        )
    };

    const offerDescription = callDocument?.offer;
    if (!offerDescription) return;

    const rtcOfferDescription = new RTCSessionDescription({
        type: offerDescription.type as RTCSdpType,
        sdp: offerDescription.sdp ?? undefined,
    });
    await peerConnection.setRemoteDescription(new RTCSessionDescription(rtcOfferDescription));

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    const answer = {
        sdp: answerDescription.sdp ?? null,
        type: answerDescription.type,
    };

    await convex.mutation(api.webrtc.addAnswer, {
        id: callId,
        answer: answer
    });

    triggers.register("calls", async () => {
        const callDocument = await convex.query(api.webrtc.getCallDocumentById, { id: callId });
        const offerCandidates = callDocument?.offerCandidates || [];

        const rtcCandidates = offerCandidates.map(c => c && ({
            candidate: c.candidate ?? undefined,
            sdpMid: c.sdpMid ?? undefined,
            sdpMLineIndex: c.sdpMLineIndex ?? undefined,
            usernameFragment: c.usernameFragment ?? undefined,
        }));

        await Promise.all(rtcCandidates.map(c => c && peerConnection.addIceCandidate(new RTCIceCandidate(c))));
    });
};