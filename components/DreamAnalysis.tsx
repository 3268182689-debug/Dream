import React, { useState, useRef, useEffect } from 'react';
import { DreamData } from '../types';
import { DreamChat } from './DreamChat';
import ReactMarkdown from 'react-markdown';
import { RefreshCcw, Download, Volume2, Loader2, Square } from 'lucide-react';
import { generateDreamSpeech, playDreamSpeech } from '../services/geminiService';

interface DreamAnalysisProps {
  data: DreamData;
  onReset: () => void;
}

export const DreamAnalysis: React.FC<DreamAnalysisProps> = ({ data, onReset }) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const stopAudioRef = useRef<(() => void) | null>(null);
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (stopAudioRef.current) {
        stopAudioRef.current();
      }
    };
  }, []);

  const handlePlayInterpretation = async () => {
    if (isPlayingAudio) {
      // Stop logic
      if (stopAudioRef.current) {
        stopAudioRef.current();
        stopAudioRef.current = null;
      }
      setIsPlayingAudio(false);
      return;
    }

    setIsLoadingAudio(true);
    try {
      const base64Audio = await generateDreamSpeech(data.interpretation);
      const stopFn = await playDreamSpeech(base64Audio, () => {
        setIsPlayingAudio(false);
        stopAudioRef.current = null;
      });
      stopAudioRef.current = stopFn;
      setIsPlayingAudio(true);
    } catch (err) {
      console.error("Failed to play audio:", err);
      alert("抱歉，语音播放失败。");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Top Section: Image & Interpretation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Image */}
        <div className="space-y-4">
          <div className="glass-panel p-2 rounded-2xl shadow-2xl relative group overflow-hidden">
            <img 
              src={data.imageUrl} 
              alt="Surrealist Dream Visualization" 
              className="w-full h-auto rounded-xl shadow-lg transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                <p className="text-white/80 text-xs italic line-clamp-2">{data.imagePrompt}</p>
            </div>
            <a 
              href={data.imageUrl} 
              download={`dream-visualization-${new Date().toISOString()}.png`}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/80 transition"
              title="下载图片"
            >
              <Download className="w-5 h-5" />
            </a>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-sm font-bold text-purple-300 uppercase tracking-widest mb-3">梦境转录</h3>
            <p className="text-purple-100/80 italic text-sm leading-relaxed">"{data.transcript}"</p>
          </div>
        </div>

        {/* Right Column: Interpretation */}
        <div className="glass-panel rounded-2xl p-8 flex flex-col h-full relative">
          <h2 className="text-2xl font-serif text-white mb-6 border-b border-white/10 pb-4">原型分析</h2>
          <div className="prose prose-invert prose-purple text-gray-300 text-sm leading-relaxed flex-grow overflow-y-auto max-h-[500px] pr-2 custom-scrollbar mb-4">
             <ReactMarkdown>{data.interpretation}</ReactMarkdown>
          </div>
          
          <div className="pt-2 mt-auto border-t border-white/10 flex justify-end">
            <button
              onClick={handlePlayInterpretation}
              disabled={isLoadingAudio}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isPlayingAudio 
                  ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/30' 
                  : 'bg-purple-600/20 text-purple-200 hover:bg-purple-600/30 border border-purple-500/30'
              }`}
            >
              {isLoadingAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在生成语音...
                </>
              ) : isPlayingAudio ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  停止播放
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  朗读分析结果
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Chat */}
      <div className="glass-panel rounded-2xl p-1 md:p-4">
         <DreamChat context={`Transcript: ${data.transcript}\n\nInterpretation: ${data.interpretation}`} />
      </div>

      <div className="flex justify-center pt-8">
        <button 
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/20 hover:bg-white/10 text-white/70 transition text-sm"
        >
          <RefreshCcw className="w-4 h-4" /> 分析另一个梦境
        </button>
      </div>
    </div>
  );
};
