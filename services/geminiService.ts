import { GoogleGenAI, Type, Chat, Modality } from "@google/genai";
import { ImageSize, DreamAnalysisResult } from "../types";

// Ensure API key is present
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing in process.env");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

/**
 * Converts a Blob to a Base64 string.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/wav;base64,")
      const base64Content = base64String.split(",")[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Analyzes audio: Transcribes, interprets, and creates an image prompt.
 * Uses gemini-3-pro-preview.
 */
export async function analyzeDreamAudio(audioBlob: Blob): Promise<DreamAnalysisResult> {
  const base64Audio = await blobToBase64(audioBlob);

  const prompt = `
    你是一位专业的荣格心理分析师和解梦专家。
    请听这段梦境的录音。
    
    1. 逐字转录音频内容（请识别并输出中文）。
    **非常重要：** 如果音频中主要是静音、背景噪音，或者没有清晰的人声在讲述梦境，请务必不要编造任何内容。
    在这种情况下，请将 json 中的 'transcript' 字段设为 "（未检测到清晰的梦境描述，请检查麦克风后重试）"，'interpretation' 设为 "无法解读"，'imagePrompt' 设为 "abstract cloudy void, confusion, mist, high quality, surrealist"。

    2. 如果有清晰的梦境描述，请基于荣格原型和核心情感主题，提供结构化的心理学解读（请使用中文）。
    3. 创建一个生动、高度详细的文本提示词(prompt)，用于生成捕捉此梦境核心情感主题和象征意义的超现实主义图像（为了获得最佳图像效果，请使用英文编写此提示词）。

    请以 JSON 格式返回结果，包含以下键：'transcript', 'interpretation', 'imagePrompt'。
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: audioBlob.type || 'audio/webm', // Fallback or detect type
            data: base64Audio
          }
        },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transcript: { type: Type.STRING },
          interpretation: { type: Type.STRING },
          imagePrompt: { type: Type.STRING },
        },
        required: ["transcript", "interpretation", "imagePrompt"],
      }
    }
  });

  const jsonText = response.text;
  if (!jsonText) {
    throw new Error("Failed to generate analysis JSON.");
  }

  try {
    return JSON.parse(jsonText) as DreamAnalysisResult;
  } catch (e) {
    console.error("Failed to parse JSON", jsonText);
    throw new Error("Invalid response format from AI.");
  }
}

/**
 * Generates an image based on the prompt.
 * Uses gemini-3-pro-image-preview.
 */
export async function generateDreamImage(prompt: string, size: ImageSize): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        { text: prompt }
      ]
    },
    config: {
      imageConfig: {
        imageSize: size,
        aspectRatio: "1:1" // Square for journal aesthetic
      }
    }
  });

  // Iterate to find the image part
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image generated.");
}

/**
 * Creates a chat session for follow-up questions.
 * Uses gemini-3-pro-preview.
 */
export function createDreamChat(context: string): Chat {
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: `
        你是一位荣格心理分析解梦助手。
        你刚刚分析了用户的梦境。
        以下是梦境的背景信息（转录和解读）：
        ${context}
        
        回答用户关于梦中符号、含义和原型的后续问题。
        请务必使用中文回答，保持洞察力、同理心和深度。
      `
    }
  });
}

// --- Text to Speech Helpers ---

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*`_~]/g, '') // Remove formatting chars
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text, remove url
    .replace(/\n+/g, '。'); // Replace newlines with pauses
}

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodePCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  // data.buffer might be larger than data's view, so we slice specifically
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Generates speech for the given text.
 * Returns the base64 encoded PCM audio.
 */
export async function generateDreamSpeech(text: string): Promise<string> {
  const cleanText = stripMarkdown(text);
  
  // Truncate if too long to prevent errors (though the model handles quite a bit)
  const safeText = cleanText.substring(0, 3000); 

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: safeText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Aoede' }, // 'Aoede' is often good for storytelling
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio generated.");
  }
  return base64Audio;
}

/**
 * Plays the base64 encoded PCM audio.
 * Returns a function to stop the audio.
 */
export async function playDreamSpeech(base64Audio: string, onEnded: () => void): Promise<() => void> {
  // Create context on user gesture (assumed this is called from click handler)
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass({ sampleRate: 24000 });
  
  try {
    const pcmData = decodeBase64(base64Audio);
    const buffer = await decodePCM(pcmData, ctx);
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    source.onended = () => {
      onEnded();
      ctx.close();
    };
    
    source.start();
    
    return () => {
      try {
        source.stop();
        ctx.close();
      } catch (e) {
        // ignore errors on cleanup
      }
    };
  } catch (e) {
    console.error("Audio playback error:", e);
    onEnded();
    ctx.close();
    return () => {};
  }
}
