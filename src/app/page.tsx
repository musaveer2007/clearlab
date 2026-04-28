"use client";

import { useState, useEffect } from "react";
import { UploadCloud, FileText, Activity, ShieldCheck, Loader2, Globe } from "lucide-react";
import Dashboard, { DashboardData } from "@/components/Dashboard";
import { supabase } from "@/utils/supabase/client";
import { extractTextFromPDF } from "@/utils/pdfExtractor";
import { compressImage } from "@/utils/imageCompressor";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [language, setLanguage] = useState("English");
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && (selectedFile.type === "application/pdf" || selectedFile.type.startsWith("image/"))) {
      setFile(selectedFile);
      setError(null);
    } else if (selectedFile) {
      setError("Please select a valid PDF or Image file.");
      setFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.type === "application/pdf" || droppedFile.type.startsWith("image/"))) {
      setFile(droppedFile);
      setError(null);
    } else if (droppedFile) {
      setError("Please select a valid PDF or Image file.");
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");

    // Compress images before upload
    let fileToUpload: File | Blob = file;
    if (isImage) {
      try {
        fileToUpload = await compressImage(file);
      } catch (err) {
        console.error("Image compression failed, using original file:", err);
      }
    }

    formData.append("file", fileToUpload);
    formData.append("language", language);

    // If it's a PDF, extract text client-side before uploading
    if (isPDF) {
      try {
        const extractedText = await extractTextFromPDF(file);
        formData.append("pdfText", extractedText);
      } catch (pdfErr) {
        console.error("Client-side PDF extraction failed:", pdfErr);
        setError("Failed to read the PDF file. It might be a scanned document or corrupted. Please try uploading a screenshot (JPG/PNG) instead.");
        setIsUploading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error("Server returned an invalid response. Please try again.");
      }

      if (!res.ok || !json.success) {
        // Sanitize: never show raw JSON or technical errors to user
        const rawMsg = json?.error || "";
        if (typeof rawMsg === "string" && rawMsg.length < 200 && !rawMsg.startsWith("{")) {
          throw new Error(rawMsg);
        }
        throw new Error("The AI service is temporarily busy. Please wait a moment and try again.");
      }

      setDashboardData(json.data);
      
      if (session) {
        const { data: report } = await supabase.from('lab_reports').insert({
          user_id: session.user.id,
          summary: json.data.summary
        }).select().single();

        if (report) {
          const resultsToInsert = json.data.results.map((r: any) => ({
            report_id: report.id,
            test_name: r.testName,
            value: r.value,
            unit: r.unit,
            reference_range: r.referenceRange,
            risk_level: r.riskLevel,
            explanation: r.explanation
          }));
          await supabase.from('lab_results').insert(resultsToInsert);
        }
      }
      
    } catch (err: any) {
      const msg = err?.message || "";
      // Final safety net: never show JSON or overly technical errors
      if (msg.includes("{") || msg.includes('"code"') || msg.length > 200) {
        setError("Something went wrong. Please try again in a moment.");
      } else {
        setError(msg || "An unexpected error occurred.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setDashboardData(null);
    setError(null);
  };

  if (dashboardData) {
    return (
      <div className="py-8">
        <Dashboard data={dashboardData} onReset={handleReset} />
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-[80vh]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <div className="max-w-3xl w-full space-y-8 text-center">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
            Understand your lab results. <br />
            <span className="text-brand-blue">Without the medical jargon.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-300 max-w-2xl mx-auto">
            Upload your PDF lab report to get a clear, calm, and educational explanation of your results. Prepare better for your next doctor's visit.
          </p>
        </div>

        <div className="mt-10 max-w-xl mx-auto glass-panel rounded-2xl overflow-hidden">
          <div className="p-8">
            <div className="flex flex-col items-center justify-center w-full">
              <label
                htmlFor="dropzone-file"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ease-in-out
                  ${isDragging ? "border-brand-blue bg-brand-blue/10" : file ? "border-brand-green bg-brand-green/10" : "border-white/20 bg-white/5 hover:bg-white/10"}`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {file ? (
                    <FileText className="w-12 h-12 text-brand-green mb-4" />
                  ) : (
                    <UploadCloud className="w-12 h-12 text-brand-blue mb-4" />
                  )}
                  <p className="mb-2 text-sm text-slate-300 font-medium">
                    {file ? (
                      <span className="text-brand-green font-semibold">{file.name}</span>
                    ) : (
                      <>
                        <span className="font-semibold text-brand-blue">Click to upload</span> or drag and drop
                      </>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">PDF, PNG, JPG, or WEBP (Max 10MB)</p>
                </div>
                <input
                  id="dropzone-file"
                  type="file"
                  className="hidden"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {error && (
              <div className="mt-4 flex flex-col items-center gap-3 glass-panel rounded-xl p-4 border border-red-500/30 bg-red-500/10">
                <p className="text-brand-red text-sm font-medium text-center">{error}</p>
                <button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="text-xs px-4 py-2 rounded-lg bg-brand-blue hover:bg-blue-600 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 Retry
                </button>
              </div>
            )}

            <div className="mt-6 flex items-center justify-center space-x-3 glass-panel rounded-lg p-3">
              <Globe className="w-5 h-5 text-slate-300" />
              <span className="text-sm font-medium text-white">Translate to:</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="glass-input text-sm rounded-md block p-2"
              >
                <option value="English" className="text-slate-900">English</option>
                <option value="Spanish" className="text-slate-900">Spanish</option>
                <option value="French" className="text-slate-900">French</option>
                <option value="German" className="text-slate-900">German</option>
                <option value="Hindi" className="text-slate-900">Hindi</option>
                <option value="Mandarin" className="text-slate-900">Mandarin</option>
              </select>
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className={`mt-6 w-full flex items-center justify-center py-3 px-4 border border-transparent text-base font-medium rounded-lg transition-all duration-200
                ${!file || isUploading 
                  ? "bg-white/10 text-slate-400 cursor-not-allowed" 
                  : "bg-brand-blue hover:bg-blue-600 text-white shadow-md hover:shadow-lg"
                }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Analyzing Report...
                </>
              ) : (
                "Analyze My Report"
              )}
            </button>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-100 text-brand-blue mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-medium text-white">100% Private</h3>
            <p className="mt-2 text-sm text-slate-300">We do not store your health information. Files are processed temporarily.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-brand-green/20 text-brand-green mb-4">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-medium text-white">Clear Explanations</h3>
            <p className="mt-2 text-sm text-slate-300">Complex medical terms translated into everyday language.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-brand-yellow/20 text-brand-yellow mb-4">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-medium text-white">Doctor Prep</h3>
            <p className="mt-2 text-sm text-slate-300">Get specific questions to ask your doctor based on your results.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
