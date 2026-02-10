'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  generatePersonalExperience,
  getVideoStatus,
  type ApiError,
} from './actions';

export default function Home() {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Refactored state to track the *active* job separately from form inputs
  const [activeJob, setActiveJob] = useState<{ id: string; name: string; company: string } | null>(null);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);

  const [error, setError] = useState<ApiError | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('professional');
  const [showArchitecture, setShowArchitecture] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smartBackground, setSmartBackground] = useState(false);
  const [watermarkUrl, setWatermarkUrl] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  const templates: Record<string, string> = {
    professional: "Hello ${name}. This is a professional briefing for ${companyName}. Our technology represents the pinnacle of AI video synthesis. We look forward to a successful partnership.",
    sales: "Hi ${name}! I'm so excited to show you what we can do for ${companyName}. Our replicas are a game-changer for engagement. Let's get started!",
    casual: "Hey ${name}! Just a quick personalized hello for you and the team at ${companyName}. Hope you're having a great day. Let's connect soon!",
  };

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  }, []);

  const addToHistory = useCallback((id: string, name: string, company: string, url: string) => {
    setHistory((prev) => {
      // Check if already in history to avoid duplicates
      if (prev.some(item => item.id === id)) return prev;
      const newEntry = { id, name, company, url, date: new Date().toLocaleString() };
      const updated = [newEntry, ...prev.slice(0, 4)];
      localStorage.setItem('tavus_history', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tavus_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Polling logic - Depends on activeJob, NOT form inputs
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (activeJob && (videoStatus === 'queued' || videoStatus === 'processing')) {
      interval = setInterval(async () => {
        const result = await getVideoStatus(activeJob.id);

        if (result.success && result.status) {
          // Only update status if it changed to avoid spamming logs? 
          // Actually, duplicate logs are fine for "still processing" feedback, 
          // but maybe we check if status changed. For now, keep as is.
          setVideoStatus(result.status);

          // Log status changes or periodic updates
          if (videoStatus !== result.status) {
            addLog(`Status Update: ${result.status}`);
          }

          if (result.status === 'ready' && result.videoUrl) {
            setVideoUrl(result.videoUrl);
            addLog('✓ Video is ready for playback!');
            addToHistory(activeJob.id, activeJob.name, activeJob.company, result.videoUrl);

            // Clear active job so we stop polling (or setIsGenerating(false) if we want)
            // We keep it 'ready' but stop the interval naturally via deps or logic?
            // Actually, we should set isGenerating to false here too if we want auto-stop.
            setIsGenerating(false);
          } else if (result.status === 'failed') {
            addLog('❌ Video generation failed.');
            setIsGenerating(false);
          }
        }
      }, 5000); // Poll every 5 seconds
    }

    return () => clearInterval(interval);
  }, [activeJob, videoStatus, addLog, addToHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !companyName.trim()) {
      addLog('Error: Please fill in all fields');
      return;
    }

    setIsGenerating(true);
    setLogs([]);
    setVideoUrl(null);
    setActiveJob(null); // Reset before starting new
    setVideoStatus(null);
    setError(null);

    // Manual Logging Flow for the "SE" Experience
    addLog('Initializing request...');
    addLog(`Template: ${selectedTemplate}`);
    addLog('Preparing Phoenix-3 rendering engine...');
    addLog(`Target Payload: { name: "${name}", company: "${companyName}" }`);

    try {
      addLog('Sending request to secure Next.js Server Action...');

      const templateKey = selectedTemplate || 'professional';
      const templateString = templates[templateKey] || templates.professional;

      const script = templateString
        .replace('${name}', name)
        .replace('${companyName}', companyName);

      const background_url = smartBackground
        ? `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`
        : undefined;

      if (background_url) addLog(`Adv. Param: background_url = ${background_url}`);
      if (watermarkUrl) addLog('Adv. Param: watermark_url is set');

      // Capture current values for the job, protecting against form edits
      const jobName = name;
      const jobCompany = companyName;

      const result = await generatePersonalExperience(jobName, jobCompany, script, {
        background_url,
        watermark_url: watermarkUrl || undefined
      });

      if (result.success && result.videoId) {
        addLog('API Response: 200 OK');
        addLog(`Video ID: ${result.videoId}`);

        // Start tracking this job
        setActiveJob({ id: result.videoId, name: jobName, company: jobCompany });

        setVideoStatus(result.status || 'queued');
        addLog(`Initial Status: ${result.status || 'queued'}`);

        if (result.videoUrl) {
          setVideoUrl(result.videoUrl);
          if (result.status === 'ready') {
            addToHistory(result.videoId, jobName, jobCompany, result.videoUrl);
            setIsGenerating(false);
          }
        }
      } else {
        const err = result.error || { type: 'UNKNOWN_ERROR', message: 'Failed to generate video' };
        setError(err as ApiError);
        addLog(`Error: ${err.message}`);
        setIsGenerating(false);
      }
    } catch (error) {
      const unknownError: ApiError = {
        type: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
        developerMessage: error instanceof Error ? error.message : 'Failed to generate video',
      };
      setError(unknownError);
      addLog(`Exception: ${unknownError.developerMessage}`);
      setIsGenerating(false);
    }
    // removed finally block since we handle isGenerating(false) in specific success/fail cases 
    // to keep polling visual state active if needed
  };

  const getErrorColor = (errorType: ApiError['type']) => {
    switch (errorType) {
      case 'AUTH_ERROR': return 'text-red-400 border-red-500/50 bg-red-950/20';
      case 'RATE_LIMIT_ERROR': return 'text-yellow-400 border-yellow-500/50 bg-yellow-950/20';
      case 'PAYMENT_ERROR': return 'text-pink-400 border-pink-500/50 bg-pink-950/20 font-bold';
      case 'VALIDATION_ERROR': return 'text-orange-400 border-orange-500/50 bg-orange-950/20';
      case 'NETWORK_ERROR': return 'text-blue-400 border-blue-500/50 bg-blue-950/20';
      default: return 'text-red-400 border-red-500/50 bg-red-950/20';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-7xl relative z-10">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700/50 mb-6">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-400 uppercase tracking-tighter">Enterprise Onboarding Sandbox</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight">
            Tavus Experience
          </h1>
          <p className="text-gray-400 text-xl max-w-2xl mx-auto">
            Personalized video onboarding. <span className="text-gray-500">Secure. Scalable. AI-Driven.</span>
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8 shadow-2xl hover:border-gray-600/50 transition-all">
              <h2 className="text-2xl font-semibold text-gray-100 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Personal Information
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/60 border border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                    placeholder="e.g. John Doe"
                    disabled={isGenerating}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/60 border border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                    placeholder="e.g. Tavus"
                    disabled={isGenerating}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Style Template</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/60 border border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none transition-all appearance-none cursor-pointer"
                    disabled={isGenerating}
                  >
                    <option value="professional">Professional Briefing</option>
                    <option value="sales">Excited Sales Pitch</option>
                    <option value="casual">Friendly Intro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-gray-500 hover:text-gray-400 flex items-center gap-1 transition-colors"
                  >
                    {showAdvanced ? '− Hide' : '+ Show'} Advanced Settings
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 p-4 bg-gray-900/40 rounded-xl border border-gray-700/30 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-300 block">Smart Background</label>
                          <p className="text-[10px] text-gray-500">Record {companyName || 'brand'}.com as backdrop</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSmartBackground(!smartBackground)}
                          className={`w-10 h-5 rounded-full transition-colors relative ${smartBackground ? 'bg-purple-600' : 'bg-gray-700'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${smartBackground ? 'left-6' : 'left-1'}`} />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-300 block">Custom Watermark URL</label>
                        <input
                          type="url"
                          value={watermarkUrl}
                          onChange={(e) => setWatermarkUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 bg-black/40 border border-gray-700/50 rounded-lg text-xs focus:ring-1 focus:ring-purple-500/50 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-white shadow-lg transform hover:scale-[1.01] transition-all disabled:opacity-50"
                >
                  {isGenerating ? 'Orchestrating AI...' : 'Generate Experience'}
                </button>
              </form>
            </div>

            {error && (
              <div className={`border rounded-2xl p-6 backdrop-blur-xl ${getErrorColor(error.type)}`}>
                <h3 className="font-bold mb-1 underline">Error: {error.type}</h3>
                <p className="text-sm opacity-90">{error.message}</p>
              </div>
            )}

            {videoUrl && (
              <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 animate-in fade-in space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold">Generated Preview</h3>
                    {videoStatus && videoStatus !== 'ready' && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase animate-pulse">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                        {videoStatus}
                      </span>
                    )}
                    {videoStatus === 'ready' && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold uppercase">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                        Ready
                      </span>
                    )}
                  </div>
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 group"
                  >
                    Open in Tavus
                    <svg className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                <div className="aspect-video bg-black rounded-lg overflow-hidden border border-gray-700 relative">
                  <iframe
                    src={videoUrl}
                    allow="autoplay; fullscreen"
                    className="absolute inset-0 w-full h-full border-0"
                    title="Tavus Video Preview"
                  />
                </div>

                <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700/50 flex items-center justify-between gap-4">
                  <code className="text-xs text-gray-400 truncate flex-1">{videoUrl}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(videoUrl);
                      addLog('✓ Video URL copied to clipboard');
                    }}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-bold transition-all shrink-0"
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            )}

            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 shadow-2xl">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent Generations
              </h3>
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div key={entry.id} className="bg-gray-900/60 p-3 rounded-xl border border-gray-700/30 flex items-center justify-between group">
                      <div className="truncate">
                        <div className="text-sm font-medium truncate">{entry.name} @ {entry.company}</div>
                        <div className="text-[10px] text-gray-500">{entry.date}</div>
                      </div>
                      <button
                        onClick={() => {
                          setVideoUrl(entry.url);
                          addLog(`Loaded historical video: ${entry.id}`);
                        }}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center border-2 border-dashed border-gray-700/50 rounded-xl">
                  <p className="text-xs text-gray-500">No session history yet. Generate your first experience to see it here.</p>
                </div>
              )}
            </div>

            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 shadow-2xl">
              <button
                onClick={() => setShowArchitecture(!showArchitecture)}
                className="w-full text-left text-lg font-bold flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Technical Architecture
                </span>
                <svg className={`w-5 h-5 transition-transform ${showArchitecture ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showArchitecture && (
                <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="p-4 bg-black rounded-xl border border-gray-700 font-mono text-[10px] text-gray-400 overflow-x-auto">
                    <div className="flex flex-col items-center gap-2">
                      <div className="px-3 py-1 border border-blue-500 text-blue-400 rounded">Frontend (Client)</div>
                      <div className="h-4 border-l border-gray-700"></div>
                      <div className="px-3 py-1 border border-purple-500 text-purple-400 rounded">Server Action (Next.js)</div>
                      <div className="h-4 border-l border-gray-700"></div>
                      <div className="px-3 py-1 border border-pink-500 text-pink-400 rounded">Tavus API v2</div>
                      <div className="h-4 border-l border-gray-700"></div>
                      <div className="px-3 py-1 border border-green-500 text-green-400 rounded">Phoenix-3 Engine</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Secure implementation using Next.js Server Actions to protect the API key while maintaining a reactive UX via status polling and local persistence.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Technical Terminal Column */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden flex flex-col min-h-[500px]">
            <div className="bg-gray-900/80 px-5 py-4 border-b border-gray-700/50 flex justify-between items-center">
              <span className="text-gray-300 font-mono text-sm tracking-widest">TECHNICAL_OUTPUT_LOG</span>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50 animate-pulse"></div>
              </div>
            </div>

            <div className="p-6 font-mono text-sm overflow-y-auto flex-1 bg-black/50">
              {logs.length === 0 ? (
                <div className="text-gray-700 italic">SYSTEM_IDLE: Awaiting input parameters...</div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-purple-500 tracking-tighter shrink-0">{">"}</span>
                      <span className={log.includes('✓') ? 'text-green-400' : log.includes('Error') ? 'text-red-400' : 'text-gray-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}