import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, UploadCloud, ChevronDown, RefreshCw } from 'lucide-react';
import { ImageSize } from '../types';

interface DreamRecorderProps {
  onProcess: (audio: Blob, size: ImageSize) => void;
}

export const DreamRecorder: React.FC<DreamRecorderProps> = ({ onProcess }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [volume, setVolume] = useState(0); // For visualization
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const visualize = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const avg = sum / dataArray.length;
    
    // Normalize slightly for better visual effect (0-100 range roughly)
    setVolume(Math.min(100, avg * 2.5));
    
    animationFrameRef.current = requestAnimationFrame(visualize);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Audio Context for Visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      analyser.fftSize = 64; // Low detail needed for simple volume pulse
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      
      visualize(); // Start visualization loop

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
        
        // Stop visualization
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setVolume(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("记录梦境需要使用麦克风权限，请确保您已允许浏览器访问麦克风。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProcess = () => {
    if (audioBlob) {
      onProcess(audioBlob, imageSize);
    }
  };

  const handleReRecord = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

  // Calculate dynamic scale based on volume
  const scale = 1 + (volume / 100) * 0.5; // Scale between 1.0 and 1.5

  return (
    <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-2xl">
      <h2 className="text-3xl font-serif text-white mb-2">记录您的梦境</h2>
      <p className="text-purple-200/60 mb-8">趁记忆犹新畅所欲言，剩下的交给我们。</p>

      {/* Visualization / Timer Circle */}
      <div 
        className={`w-40 h-40 rounded-full border-2 flex items-center justify-center mb-8 transition-all duration-75 relative z-10 ${
          isRecording 
            ? 'border-red-400 bg-red-900/10' 
            : 'border-purple-400/30 bg-purple-900/10'
        }`}
        style={{
           transform: isRecording ? `scale(${scale})` : 'scale(1)',
           boxShadow: isRecording ? `0 0 ${volume}px rgba(248,113,113,0.5)` : 'none'
        }}
      >
        {isRecording ? (
          <div className="flex flex-col items-center">
             <span className="text-3xl font-mono text-red-200">{formatTime(recordingTime)}</span>
             <span className="text-xs text-red-400 uppercase tracking-widest mt-1">
               {volume > 10 ? '正在录音' : '请说话...'}
             </span>
          </div>
        ) : (
          audioBlob ? (
             <Play className="w-16 h-16 text-purple-300 ml-2" />
          ) : (
            <Mic className="w-16 h-16 text-purple-300/50" />
          )
        )}
      </div>
      
      {/* Helper text for mic check */}
      {isRecording && volume < 5 && (
        <p className="text-amber-400 text-sm mb-6 animate-bounce">未检测到声音，请检查麦克风...</p>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-6 w-full max-w-sm relative z-20">
        
        {!audioBlob ? (
          !isRecording ? (
            <button 
              onClick={startRecording}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold tracking-wide shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Mic className="w-5 h-5" /> 开始录音
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="w-full py-4 rounded-xl bg-red-500/80 hover:bg-red-500 text-white font-semibold tracking-wide shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Square className="w-5 h-5 fill-current" /> 停止录音
            </button>
          )
        ) : (
          <>
            {/* Image Size Selector */}
            <div className="w-full bg-white/5 rounded-lg p-3 flex items-center justify-between border border-white/10">
              <span className="text-sm text-purple-200">生成画质</span>
              <div className="relative">
                <select 
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as ImageSize)}
                  className="appearance-none bg-black/30 border border-purple-500/30 rounded px-3 py-1 pr-8 text-sm text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="1K">1K (方形)</option>
                  <option value="2K">2K (高清)</option>
                  <option value="4K">4K (超清)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-purple-300 absolute right-2 top-1.5 pointer-events-none" />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleReRecord}
                className="flex-1 py-3 rounded-lg border border-white/20 hover:bg-white/5 text-purple-200 font-medium text-sm transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> 重录
              </button>
              <button 
                onClick={handleProcess}
                className="flex-[2] py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold tracking-wide shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-5 h-5" /> 分析梦境
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};