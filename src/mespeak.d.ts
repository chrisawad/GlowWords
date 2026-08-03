declare module 'mespeak' {
  interface SpeakOptions {
    amplitude?: number;
    pitch?: number;
    speed?: number;
    volume?: number;
    rawdata?: boolean;
  }

  interface MeSpeak {
    loadConfig(config: object): void;
    loadVoice(voice: object): void;
    speak(text: string, options?: SpeakOptions, callback?: (success: boolean) => void): number | ArrayBuffer | null;
    stop(): number;
  }

  const meSpeak: MeSpeak;
  export default meSpeak;
}
