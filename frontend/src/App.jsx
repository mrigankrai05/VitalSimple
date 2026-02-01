import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, Send, Activity, AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// --- COMPONENT: ANALYSIS CARD (The "Big" Summary) ---
// --- COMPONENT: ANALYSIS CARD (Updated with Full Table) ---
const AnalysisCard = ({ data }) => {
  if (!data) return null;
  return (
    <div className="w-full bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-4">
      <div className="bg-blue-600 p-4 text-white font-bold text-lg flex items-center gap-2">
        <Activity className="w-6 h-6" /> Medical Report Analysis
      </div>

      <div className="p-6 space-y-6">
        {/* Executive Summary */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="font-bold text-slate-700 mb-2 uppercase text-sm tracking-wider">Executive Summary</h4>
          <p className="text-slate-700 leading-relaxed text-lg">{data.summary}</p>
        </div>

        {/* The 3 Status Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 p-5 rounded-xl border border-red-100">
            <h4 className="flex items-center gap-2 font-bold text-red-700 mb-3 text-lg"><AlertCircle className="w-5 h-5" /> Attention</h4>
            <ul className="space-y-2 text-sm text-red-800">
              {data.risk_areas?.map((item, i) => <li key={i}>• {item}</li>)}
            </ul>
          </div>
          <div className="bg-amber-50 p-5 rounded-xl border border-amber-100">
            <h4 className="flex items-center gap-2 font-bold text-amber-700 mb-3 text-lg"><Info className="w-5 h-5" /> Borderline</h4>
            <ul className="space-y-2 text-sm text-amber-900">
              {data.moderate_areas?.map((item, i) => <li key={i}>• {item}</li>)}
            </ul>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100">
            <h4 className="flex items-center gap-2 font-bold text-emerald-700 mb-3 text-lg"><CheckCircle className="w-5 h-5" /> Normal</h4>
            <ul className="space-y-2 text-sm text-emerald-900">
              {data.healthy_areas?.map((item, i) => <li key={i}>• {item}</li>)}
            </ul>
          </div>
        </div>

        {/* NEW: Comprehensive Data Table */}
        {data.all_metrics && data.all_metrics.length > 0 && (
          <div className="mt-6 border rounded-xl overflow-hidden border-slate-200">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-slate-700 flex justify-between">
              <span>Detailed Report Data</span>
              <span className="text-xs font-normal text-slate-500 mt-1">{data.all_metrics.length} metrics extracted</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                  <tr>
                    <th className="px-6 py-3">Test Name</th>
                    <th className="px-6 py-3">Result</th>
                    <th className="px-6 py-3">Units</th>
                    <th className="px-6 py-3">Normal Range</th>
                  </tr>
                </thead>
                <tbody>
                  {data.all_metrics.map((metric, index) => (
                    <tr key={index} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{metric.name}</td>
                      <td className="px-6 py-4 font-bold text-blue-600">{metric.value}</td>
                      <td className="px-6 py-4 text-slate-500">{metric.unit}</td>
                      <td className="px-6 py-4 text-slate-500 italic">{metric.normal_range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENT: GAUGE CHART ---
const GaugeChart = ({ data }) => {
  if (!data) return null;
  const min = data.min || 0;
  const max = data.max || data.value * 1.5;
  const value = data.value;
  const chartData = [{ name: 'Value', value: value }, { name: 'Remaining', value: max - value }];
  const color = data.status === 'High' || data.status === 'Low' ? '#EF4444' : '#22C55E';

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 mt-2 w-64 shadow-sm">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{data.metric}</h4>
      <div className="h-32 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius={40} outerRadius={60} paddingAngle={0} dataKey="value">
              <Cell fill={color} /><Cell fill="#e2e8f0" />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute bottom-0 left-0 right-0 text-center -mb-2">
          <span className="text-xl font-bold text-slate-700">{data.value}</span>
          <span className="text-xs text-slate-400 ml-1">{data.unit}</span>
        </div>
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-2 px-2">
        <span>{min}</span><span className={`font-medium ${data.status === 'Normal' ? 'text-green-600' : 'text-red-500'}`}>{data.status}</span><span>{max}</span>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [file, setFile] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false); // <--- Loading State
  const [isAnalyzing, setIsAnalyzing] = useState(false); // <--- Upload Loading State

  // Chat history starts empty. We push the Analysis Card into it later.
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', text: "Hello! Upload your medical report (PDF) below to start." }
  ]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping, isAnalyzing]);

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true); // Start loading UI

    // Add a temporary "Uploading..." message
    setChatHistory(prev => [...prev, { role: 'user', text: `Uploaded: ${file.name}` }]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://localhost:8000/analyze", formData);
      const parsed = JSON.parse(res.data.analysis);
      setSessionId(res.data.session_id);

      // Push the BIG ANALYSIS CARD into the chat history
      setChatHistory(prev => [
        ...prev,
        { role: 'bot', type: 'analysis', data: parsed }
      ]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "Error analyzing file. Please try again." }]);
    } finally {
      setIsAnalyzing(false); // Stop loading UI
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !sessionId) return;

    const userMsg = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true); // Show "Thinking..." bubble

    try {
      const res = await axios.post("http://localhost:8000/chat", {
        session_id: sessionId,
        query: userMsg
      });

      setChatHistory(prev => [...prev, {
        role: 'bot',
        text: res.data.answer,
        visualization: res.data.visualization
      }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "Connection error." }]);
    } finally {
      setIsTyping(false); // Hide "Thinking..." bubble
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col items-center py-10">

      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[85vh]">

        {/* Header */}
        <div className="bg-blue-900 p-4 text-white flex items-center gap-3 shadow-md z-10">
          <Activity className="text-blue-300 w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold">MedRAG AI</h1>
            <p className="text-xs text-blue-200">Private Local Analysis</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

              {/* RENDER ANALYSIS CARD */}
              {msg.type === 'analysis' ? (
                <AnalysisCard data={msg.data} />
              ) : (
                /* RENDER NORMAL MESSAGE */
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                  }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.visualization && <GaugeChart data={msg.visualization} />}
                </div>
              )}
            </div>
          ))}

          {/* LOADING INDICATORS */}
          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-white border border-blue-100 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3 text-blue-800">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span>Scanning document & extracting data... (This takes ~50s-60s)</span>
              </div>
            </div>
          )}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          {!sessionId ? (
            // UPLOAD MODE
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
              <input type="file" onChange={(e) => setFile(e.target.files[0])} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" />
              <button onClick={handleAnalyze} disabled={!file || isAnalyzing} className="ml-auto bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2">
                {isAnalyzing ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
                Analyze
              </button>
            </div>
          ) : (
            // CHAT MODE
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Ask about your report (e.g., 'Is my cholesterol okay?')"
                className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
              <button onClick={handleChat} disabled={isTyping} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                <Send className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}