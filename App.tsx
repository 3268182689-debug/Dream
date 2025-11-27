import React, { useState } from 'react';
import { DreamRecorder } from './components/DreamRecorder';
import { DreamAnalysis } from './components/DreamAnalysis';
import { DreamData, ImageSize } from './types';
import { analyzeDreamAudio, generateDreamImage } from './services/geminiService';
import { Moon, Sparkles, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dreamData, setDreamData] = useState<DreamData | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('');

  const handleProcessDream = async (audioBlob: Blob, imageSize: ImageSize) => {
    setIsProcessing(true);
    setError(null);
    setLoadingStep('正在转录和分析梦境...');

    try {
      // Step 1: Analyze Audio
      const analysis = await analyzeDreamAudio(audioBlob);
      
      setLoadingStep('正在生成超现实主义视觉效果...');
      
      // Step 2: Generate Image
      const imageUrl = await generateDreamImage(analysis.imagePrompt, imageSize);

      setDreamData({
        transcript: analysis.transcript,
        interpretation: analysis.interpretation,
        imageUrl: imageUrl,
        imagePrompt: analysis.imagePrompt,
        timestamp: new Date(),
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "处理您的梦境时发生错误。");
    } finally {
      setIsProcessing(false);
      setLoadingStep('');
    }
  };

  const handleReset = () => {
    setDreamData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen dream-gradient flex flex-col items-center p-4 md:p-8">
      <header className="w-full max-w-4xl flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleReset}>
          <Moon className="w-8 h-8 text-purple-300" />
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-200">
            DreamWeaver
          </h1>
        </div>
        {!isProcessing && !dreamData && (
          <div className="flex items-center gap-2 text-sm text-purple-200 opacity-70">
            <Sparkles className="w-4 h-4" />
            <span>AI 梦境日志</span>
          </div>
        )}
      </header>

      <main className="w-full max-w-4xl flex-grow">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 rounded-full border-t-2 border-purple-400 animate-spin"></div>
              <Sparkles className="w-10 h-10 text-purple-300" />
            </div>
            <h2 className="text-xl font-light text-purple-100">{loadingStep}</h2>
            <p className="text-sm text-purple-300/60 mt-2">正在连接集体潜意识...</p>
          </div>
        ) : !dreamData ? (
          <DreamRecorder onProcess={handleProcessDream} />
        ) : (
          <DreamAnalysis data={dreamData} onReset={handleReset} />
        )}
      </main>

      <footer className="w-full max-w-4xl mt-12 py-6 border-t border-white/5 text-center text-xs text-white/20">
        <p>由 Google Gemini 3 Pro & Gemini 3 Pro Image 提供支持</p>
      </footer>
    </div>
  );
};

export default App;
