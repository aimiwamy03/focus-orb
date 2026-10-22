import { assemblyAiSocketUrl } from './voiceSocket';

export type VoiceTurn = {
  transcript: string;
  confidence: number | null;
  final: boolean;
};

export type VoiceStreamError = Error & { kind: 'not-setup' | 'denied' | 'offline' };

function streamError(kind: VoiceStreamError['kind'], message: string): VoiceStreamError {
  const error = new Error(message) as VoiceStreamError;
  error.kind = kind;
  return error;
}

function downsampleToPcm16(input: Float32Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const out = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function fetchVoiceToken(): Promise<string> {
  const response = await fetch('/api/voice/token', { cache: 'no-store' });
  if (response.status === 503) {
    throw streamError('not-setup', 'not-setup');
  }
  if (!response.ok) {
    throw streamError('offline', 'offline');
  }
  const data = (await response.json()) as { token?: unknown };
  if (typeof data.token !== 'string' || !data.token) {
    throw streamError('not-setup', 'not-setup');
  }
  return data.token;
}

function parseTurn(data: unknown): VoiceTurn | null {
  if (!data || typeof data !== 'object') return null;
  const msg = data as {
    type?: unknown;
    transcript?: unknown;
    end_of_turn?: unknown;
    end_of_turn_confidence?: unknown;
  };
  if (msg.type !== 'Turn' || typeof msg.transcript !== 'string') return null;
  const confidence =
    typeof msg.end_of_turn_confidence === 'number' ? msg.end_of_turn_confidence : null;
  return {
    transcript: msg.transcript,
    confidence,
    final: Boolean(msg.end_of_turn),
  };
}

export async function startLiveVoice(options: {
  onTurn?: (turn: VoiceTurn) => void;
}): Promise<{ stop: () => Promise<VoiceTurn> }> {
  const token = await fetchVoiceToken();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      throw streamError('denied', 'denied');
    }
    throw streamError('offline', 'offline');
  }

  const socket = new WebSocket(assemblyAiSocketUrl(token));
  socket.binaryType = 'arraybuffer';

  let last: VoiceTurn = { transcript: '', confidence: null, final: false };
  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return;
    try {
      const turn = parseTurn(JSON.parse(event.data));
      if (!turn) return;
      if (turn.transcript.trim()) last = turn;
      options.onTurn?.(turn);
    } catch {
      // Ignore non-JSON frames.
    }
  });

  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const mute = context.createGain();
  mute.gain.value = 0;
  processor.onaudioprocess = (event) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    const pcm = downsampleToPcm16(event.inputBuffer.getChannelData(0), context.sampleRate, 16000);
    socket.send(pcm.buffer);
  };
  source.connect(processor);
  processor.connect(mute);
  mute.connect(context.destination);

  const opened = new Promise<void>((resolve, reject) => {
    const fail = () => reject(streamError('offline', 'offline'));
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', fail, { once: true });
  });

  try {
    await opened;
  } catch (error) {
    processor.disconnect();
    source.disconnect();
    mute.disconnect();
    void context.close();
    stream.getTracks().forEach((track) => track.stop());
    socket.close();
    throw error;
  }

  return {
    stop: async () => {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'Terminate' }));
        }
      } catch {
        // Closing anyway.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
      void context.close();
      stream.getTracks().forEach((track) => track.stop());
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      return last;
    },
  };
}

export function parseVoiceTurnForTests(data: unknown): VoiceTurn | null {
  return parseTurn(data);
}
