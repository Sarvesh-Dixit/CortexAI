import { create } from 'zustand';
import type { CompressionResult, AnalysisResult, CompressionLevel } from '../types';

interface CompressionState {
  currentText: string;
  currentLevel: CompressionLevel;
  currentProvider: string;
  currentResult: CompressionResult | null;
  currentAnalysis: AnalysisResult | null;
  isCompressing: boolean;
  isAnalyzing: boolean;

  setText: (text: string) => void;
  setLevel: (level: CompressionLevel) => void;
  setProvider: (provider: string) => void;
  setResult: (result: CompressionResult | null) => void;
  setAnalysis: (analysis: AnalysisResult | null) => void;
  setCompressing: (v: boolean) => void;
  setAnalyzing: (v: boolean) => void;
  reset: () => void;
}

export const useCompressionStore = create<CompressionState>((set) => ({
  currentText: '',
  currentLevel: 'medium',
  currentProvider: 'openai',
  currentResult: null,
  currentAnalysis: null,
  isCompressing: false,
  isAnalyzing: false,

  setText: (text) => set({ currentText: text }),
  setLevel: (level) => set({ currentLevel: level }),
  setProvider: (provider) => set({ currentProvider: provider }),
  setResult: (result) => set({ currentResult: result }),
  setAnalysis: (analysis) => set({ currentAnalysis: analysis }),
  setCompressing: (v) => set({ isCompressing: v }),
  setAnalyzing: (v) => set({ isAnalyzing: v }),
  reset: () => set({
    currentText: '',
    currentResult: null,
    currentAnalysis: null,
    isCompressing: false,
    isAnalyzing: false,
  }),
}));
