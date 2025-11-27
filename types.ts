export type ImageSize = '1K' | '2K' | '4K';

export interface DreamAnalysisResult {
  transcript: string;
  interpretation: string;
  imagePrompt: string;
}

export interface DreamData {
  transcript: string;
  interpretation: string;
  imageUrl: string;
  imagePrompt: string;
  timestamp: Date;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}