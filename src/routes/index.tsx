import { createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import { motion, AnimatePresence } from 'motion/react'
import { toast, Toaster } from 'sonner'
import {
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  Copy,
  Maximize2,
  Signal,
  SignalHigh,
  SignalLow,
  Loader2,
  Radio,
  Unplug,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: Home,
})

const SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

type Status =
  | 'IDLE'
  | 'INITIALIZING'
  | 'CONNECTING'
  | 'RECEIVED OFFER'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'FAILED'

function Home() {
  const [callId, setCallId] = useState<Id<'calls'> | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<Status>('IDLE')
  const [isCaller, setIsCaller] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const pc = useRef<RTCPeerConnection | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const callInputRef = useRef<HTMLInputElement>(null)
  const processedCandidates = useRef<Set<string>>(new Set())
  const loadingToastId = useRef<string | number | undefined>(undefined)
  const callData = useQuery(api.webrtc.getCall, { id: callId })
  const createCallMutation = useMutation(api.webrtc.createCall)
  const addOfferMutation = useMutation(api.webrtc.addOffer)
  const addAnswerMutation = useMutation(api.webrtc.addAnswer)
  const addOfferCandidateMutation = useMutation(api.webrtc.addOfferCandidate)
  const addAnswerCandidateMutation = useMutation(api.webrtc.addAnswerCandidate)

  useEffect(() => {
    pc.current = new RTCPeerConnection(SERVERS)
    pc.current.ontrack = (event) => {
      const stream = event.streams[0]
      if (stream) {
        setRemoteStream(stream)
        toast.dismiss(loadingToastId.current)
        loadingToastId.current = undefined
        toast.success('Remote peer connected')
      }
    }
    pc.current.onconnectionstatechange = () => {
      const state = pc.current?.connectionState
      if (state) {
        setStatus(state.toUpperCase() as Status)
        if (state === 'connected') {
          toast.dismiss(loadingToastId.current)
          loadingToastId.current = undefined
        }
        if (state === 'failed' || state === 'disconnected') {
          toast.dismiss(loadingToastId.current)
          loadingToastId.current = undefined
        }
      }
    }
    return () => {
      pc.current?.close()
      localStream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [localStream, remoteStream])

  useEffect(() => {
    if (!pc.current || !callId) return
    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateString = JSON.stringify(event.candidate.toJSON())
        if (isCaller) {
          addOfferCandidateMutation({ id: callId, candidate: candidateString })
        } else {
          addAnswerCandidateMutation({ id: callId, candidate: candidateString })
        }
      }
    }
  }, [callId, isCaller])

  useEffect(() => {
    if (!pc.current || !callData) return
    const syncSignaling = async () => {
      const connection = pc.current!
      if (
        callData.offer &&
        connection.signalingState === 'stable' &&
        !isCaller
      ) {
        const offer = new RTCSessionDescription(
          callData.offer as RTCSessionDescriptionInit,
        )
        await connection.setRemoteDescription(offer)
        setStatus('RECEIVED OFFER')
      }
      if (
        callData.answer &&
        connection.signalingState === 'have-local-offer' &&
        isCaller
      ) {
        const answer = new RTCSessionDescription(
          callData.answer as RTCSessionDescriptionInit,
        )
        await connection.setRemoteDescription(answer)
        setStatus('CONNECTED')
      }
      const newCandidates = isCaller
        ? callData.answerCandidates
        : callData.offerCandidates
      for (const candidateString of newCandidates) {
        if (!processedCandidates.current.has(candidateString)) {
          const candidateInit = JSON.parse(candidateString)
          await connection.addIceCandidate(candidateInit)
          processedCandidates.current.add(candidateString)
        }
      }
    }
    syncSignaling()
  }, [callData, isCaller])

  const startWebcam = async () => {
    try {
      setStatus('INITIALIZING')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      setLocalStream(stream)
      setStatus('IDLE')
      stream.getTracks().forEach((track) => {
        pc.current?.addTrack(track, stream)
      })
      toast.success('Camera & microphone ready')
    } catch (err) {
      toast.error('Could not access camera or microphone')
      setStatus('FAILED')
    }
  }

  const createCall = async () => {
    if (!localStream) {
      toast.error('Start your camera first')
      return
    }
    setIsCaller(true)
    const newCallId = await createCallMutation()
    setCallId(newCallId)
    const connection = pc.current!
    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)
    await addOfferMutation({
      id: newCallId,
      offer: { type: offer.type, sdp: offer.sdp! },
    })
    toast.success('Call created! Share the ID with your peer.')
  }

  const joinCall = () => {
    if (!localStream) {
      toast.error('Start your camera first')
      return
    }
    const inputId = callInputRef.current?.value.trim()
    if (!inputId) {
      toast.error('Enter a Call ID')
      return
    }
    setIsCaller(false)
    setCallId(inputId as Id<'calls'>)
    setStatus('CONNECTING')
    loadingToastId.current = toast.loading('Joining call...')
  }

  const answerCall = async () => {
    if (!pc.current || !callId) return
    const connection = pc.current
    const answer = await connection.createAnswer()
    await connection.setLocalDescription(answer)
    await addAnswerMutation({
      id: callId,
      answer: { type: answer.type, sdp: answer.sdp! },
    })
    toast.success('Call answered!')
  }

  const hangupCall = () => {
    pc.current?.close()
    pc.current = new RTCPeerConnection(SERVERS)
    setCallId(null)
    setIsCaller(false)
    setRemoteStream(null)
    setStatus('DISCONNECTED')
    processedCandidates.current.clear()
    toast.dismiss(loadingToastId.current)
    loadingToastId.current = undefined
    toast.info('Call ended')
  }

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isAudioEnabled
      })
      setIsAudioEnabled(!isAudioEnabled)
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled
      })
      setIsVideoEnabled(!isVideoEnabled)
    }
  }

  const copyCallId = () => {
    if (callId) {
      navigator.clipboard.writeText(callId)
      toast.success('Call ID copied to clipboard')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'CONNECTED':
        return <SignalHigh className="w-4 h-4" />
      case 'CONNECTING':
      case 'INITIALIZING':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'IDLE':
        return <Signal className="w-4 h-4" />
      default:
        return <SignalLow className="w-4 h-4" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'CONNECTED':
        return 'text-[#98c379]'
      case 'CONNECTING':
      case 'INITIALIZING':
        return 'text-[#e5c07b]'
      case 'IDLE':
        return 'text-[#5c6370]'
      default:
        return 'text-[#e06c75]'
    }
  }

  return (
    <div className="min-h-screen bg-[#282c34] text-[#abb2bf] font-sans selection:bg-[#61afef]/30">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#21252b',
            color: '#abb2bf',
            border: '1px solid #3e4451',
          },
        }}
      />

      {/* Background grid pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(#abb2bf 1px, transparent 1px), linear-gradient(90deg, #abb2bf 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#61afef] flex items-center justify-center shadow-lg shadow-[#61afef]/20">
              <Radio className="w-5 h-5 text-[#282c34]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#abb2bf]">WebRTC</h1>
              <p className="text-xs text-[#5c6370] font-mono">
                P2P Video Calls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <motion.div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-[#21252b] border border-[#3e4451] ${getStatusColor()}`}
              animate={status === 'CONNECTED' ? { scale: [1, 1.02, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {getStatusIcon()}
              <span className="text-sm font-medium font-mono">{status}</span>
            </motion.div>

            <AnimatePresence>
              {callId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#21252b] border border-[#3e4451]"
                >
                  <span className="text-xs text-[#5c6370] font-mono">ID:</span>
                  <code className="text-xs text-[#61afef] font-mono">
                    {callId.slice(0, 12)}...
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={copyCallId}
                    className="h-6 w-6 text-[#5c6370] hover:text-[#abb2bf] hover:bg-[#3e4451]"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.header>

        {/* Video Stage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-8"
        >
          {/* Remote Video (Main) */}
          <div className="relative aspect-video rounded-lg overflow-hidden bg-[#21252b] border border-[#3e4451] shadow-2xl shadow-black/50">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Remote placeholder */}
            <AnimatePresence>
              {!remoteStream && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <div className="w-24 h-24 rounded-full bg-[#3e4451] flex items-center justify-center mb-4">
                    <Unplug className="w-10 h-10 text-[#5c6370]" />
                  </div>
                  <p className="text-[#5c6370] text-sm">
                    Waiting for remote peer...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fullscreen button */}
            <AnimatePresence>
              {remoteStream && status === 'CONNECTED' && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => remoteVideoRef.current?.requestFullscreen()}
                  className="absolute bottom-4 right-4 p-2 rounded-md bg-black/50 backdrop-blur-sm text-[#abb2bf] hover:text-white hover:bg-black/70 transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Local Video (Picture-in-Picture) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute bottom-4 left-4 w-48 aspect-video rounded-lg overflow-hidden bg-[#21252b] border border-[#3e4451] shadow-xl"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Local placeholder */}
            {!localStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#21252b]">
                <VideoOff className="w-8 h-8 text-[#5c6370]" />
              </div>
            )}

            {/* Local controls overlay */}
            {localStream && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent flex gap-1">
                <button
                  onClick={toggleVideo}
                  className={`p-1.5 rounded-md transition-colors ${
                    isVideoEnabled
                      ? 'bg-[#3e4451] text-[#abb2bf]'
                      : 'bg-[#e06c75] text-white'
                  }`}
                >
                  {isVideoEnabled ? (
                    <Video className="w-3 h-3" />
                  ) : (
                    <VideoOff className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={toggleAudio}
                  className={`p-1.5 rounded-md transition-colors ${
                    isAudioEnabled
                      ? 'bg-[#3e4451] text-[#abb2bf]'
                      : 'bg-[#e06c75] text-white'
                  }`}
                >
                  {isAudioEnabled ? (
                    <Signal className="w-3 h-3" />
                  ) : (
                    <Unplug className="w-3 h-3" />
                  )}
                </button>
              </div>
            )}

            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/40 text-[10px] text-[#abb2bf] font-medium">
              You
            </div>
          </motion.div>
        </motion.div>

        {/* Controls Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Setup Card */}
          <div className="p-6 rounded-lg bg-[#21252b] border border-[#3e4451]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-md bg-[#3e4451] flex items-center justify-center">
                <Video className="w-4 h-4 text-[#61afef]" />
              </div>
              <h3 className="font-semibold text-[#abb2bf]">Setup</h3>
            </div>

            <Button
              onClick={startWebcam}
              disabled={!!localStream}
              className="w-full bg-[#61afef] hover:bg-[#528bcc] text-[#282c34] font-medium shadow-lg shadow-[#61afef]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'INITIALIZING' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Video className="w-4 h-4 mr-2" />
              )}
              Start Camera
            </Button>

            <p className="mt-3 text-xs text-[#5c6370]">
              Grant camera & microphone permissions to begin
            </p>
          </div>

          {/* Connect Card */}
          <div className="p-6 rounded-lg bg-[#21252b] border border-[#3e4451]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-md bg-[#3e4451] flex items-center justify-center">
                <Phone className="w-4 h-4 text-[#c678dd]" />
              </div>
              <h3 className="font-semibold text-[#abb2bf]">Connect</h3>
            </div>

            <div className="space-y-4">
              {/* Create Call */}
              <Button
                onClick={createCall}
                disabled={!localStream || !!callId}
                variant="outline"
                className="w-full border-[#3e4451] hover:bg-[#3e4451] hover:border-[#4b5160] text-[#abb2bf] bg-transparent"
              >
                <Radio className="w-4 h-4 mr-2" />
                Create New Call
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#3e4451]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-2 bg-[#282c34] text-xs text-[#5c6370]">
                    or join existing
                  </span>
                </div>
              </div>

              {/* Join Call */}
              <div className="flex gap-2">
                <input
                  ref={callInputRef}
                  placeholder="Paste Call ID..."
                  disabled={!!callId}
                  className="flex-1 px-3 py-2 rounded-md bg-[#21252b] border border-[#3e4451] text-sm text-[#abb2bf] placeholder:text-[#5c6370] focus:outline-none focus:border-[#61afef] focus:ring-1 focus:ring-[#61afef]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
                <AnimatePresence mode="wait">
                  {!callId ? (
                    <motion.div
                      key="join"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <Button
                        onClick={joinCall}
                        disabled={!localStream}
                        className="bg-[#c678dd] hover:bg-[#b162c7] text-[#282c34] font-medium shadow-lg shadow-[#c678dd]/20"
                      >
                        Join
                      </Button>
                    </motion.div>
                  ) : status === 'RECEIVED OFFER' ? (
                    <motion.div
                      key="answer"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <Button
                        onClick={answerCall}
                        className="bg-[#56b6c2] hover:bg-[#4fa8b3] text-[#282c34] font-medium shadow-lg shadow-[#56b6c2]/20"
                      >
                        Answer
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="hangup"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <Button
                        onClick={hangupCall}
                        variant="destructive"
                        className="bg-[#e06c75] hover:bg-[#c75a62] text-[#282c34] font-medium shadow-lg shadow-[#e06c75]/20"
                      >
                        <PhoneOff className="w-4 h-4 mr-1" />
                        End
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer info */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-xs text-[#5c6370]">
            Powered by <span className="text-[#61afef]">Convex</span> +{' '}
            <span className="text-[#98c379]">WebRTC</span> +{' '}
            <span className="text-[#e5c07b]">TanStack</span>
          </p>
        </motion.footer>
      </div>
    </div>
  )
}
