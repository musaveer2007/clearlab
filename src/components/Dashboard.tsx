"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, FileQuestion, Printer, Volume2, VolumeX } from "lucide-react";

export type RiskLevel = "Green" | "Yellow" | "Red";

export interface LabTestResult {
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  riskLevel: RiskLevel;
  explanation: string;
}

export interface DashboardData {
  summary: string;
  results: LabTestResult[];
  doctorQuestions: string[];
}

export default function Dashboard({ data, onReset }: { data: DashboardData; onReset: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

  useEffect(() => {
    return () => {
      if (synth) synth.cancel();
    };
  }, [synth]);

  const toggleAudio = () => {
    if (!synth) return;
    if (isPlaying) {
      synth.cancel();
      setIsPlaying(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(data.summary);
      utterance.onend = () => setIsPlaying(false);
      synth.speak(utterance);
      setIsPlaying(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getRiskIcon = (level: RiskLevel) => {
    switch (level) {
      case "Green": return <CheckCircle2 className="w-6 h-6 text-brand-green" />;
      case "Yellow": return <AlertTriangle className="w-6 h-6 text-brand-yellow" />;
      case "Red": return <AlertCircle className="w-6 h-6 text-brand-red" />;
      default: return <CheckCircle2 className="w-6 h-6 text-slate-400" />;
    }
  };

  const getRiskBg = (level: RiskLevel) => {
    switch (level) {
      case "Green": return "bg-brand-green/10 border-brand-green/30 backdrop-blur-md";
      case "Yellow": return "bg-brand-yellow/10 border-brand-yellow/30 backdrop-blur-md";
      case "Red": return "bg-brand-red/10 border-brand-red/30 backdrop-blur-md";
      default: return "glass-panel";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header / Summary */}
      {/* Header / Summary */}
      <div className="glass-panel rounded-2xl p-8">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-3xl font-bold text-white tracking-tight">Smart Summary</h2>
          <div className="flex items-center space-x-4 print:hidden">
            <button 
              onClick={toggleAudio}
              className="text-sm flex items-center font-medium text-brand-blue hover:text-blue-700 transition-colors"
            >
              {isPlaying ? <VolumeX className="w-4 h-4 mr-1" /> : <Volume2 className="w-4 h-4 mr-1" />}
              {isPlaying ? "Stop Audio" : "Listen"}
            </button>
            <button 
              onClick={handlePrint}
              className="text-sm flex items-center font-medium text-brand-blue hover:text-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4 mr-1" />
              Print
            </button>
            <button 
              onClick={onReset}
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>
        <p className="text-lg text-slate-200 leading-relaxed">
          {data.summary}
        </p>
      </div>

      {/* Lab Cards */}
      <div className="space-y-4">
        <h3 className="text-2xl font-semibold text-white px-1">Lab Insights</h3>
        <div className="grid grid-cols-1 gap-4">
          {data.results.map((result, index) => (
            <div key={index} className={`rounded-xl border p-6 transition-all duration-200 hover:shadow-md ${getRiskBg(result.riskLevel)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  {getRiskIcon(result.riskLevel)}
                  <h4 className="text-xl font-semibold text-white">{result.testName}</h4>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {result.value} <span className="text-sm font-medium text-slate-400">{result.unit}</span>
                  </div>
                  {result.referenceRange && (
                    <div className="text-sm text-slate-400 mt-1">Normal: {result.referenceRange}</div>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-slate-200 leading-relaxed">{result.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Doctor Prep */}
      {/* Doctor Prep */}
      <div className="glass-panel rounded-2xl p-8">
        <div className="flex items-center space-x-3 mb-6">
          <FileQuestion className="w-7 h-7 text-brand-blue" />
          <h3 className="text-2xl font-semibold text-white">Doctor Prep</h3>
        </div>
        <p className="text-slate-300 mb-6">
          Consider asking your doctor the following questions based on your results:
        </p>
        <ul className="space-y-3">
          {data.doctorQuestions.map((q, idx) => (
            <li key={idx} className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-blue/20 text-brand-blue flex items-center justify-center text-sm font-bold mt-0.5">
                {idx + 1}
              </span>
              <span className="text-slate-200 font-medium">{q}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
