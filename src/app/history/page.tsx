"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";

export default function HistoryPage() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [historyData, setHistoryData] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchHistory(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchHistory(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchHistory = async (userId: string) => {
    setLoading(true);
    // Fetch reports and their results
    const { data: reports, error } = await supabase
      .from("lab_reports")
      .select(`
        id, created_at,
        lab_results ( test_name, value, unit )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!error && reports) {
      // Process data for Recharts (e.g., extracting Hemoglobin or eGFR trends)
      const chartData = reports.map((r: any) => {
        const dateObj = new Date(r.created_at);
        const entry: any = { date: dateObj.toLocaleDateString() };
        
        r.lab_results.forEach((res: any) => {
          // Try to parse value to float if possible
          const val = parseFloat(res.value);
          if (!isNaN(val)) {
            entry[res.test_name] = val;
          }
        });
        return entry;
      });
      setHistoryData(chartData);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setMessage(error.message);
    else setMessage("Check your email for the login link!");
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto mt-12 glass-panel p-8 rounded-2xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Log in to view History</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md px-3 py-2 sm:text-sm glass-input"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-blue hover:bg-blue-700"
          >
            Send Magic Link
          </button>
        </form>
        {message && <p className="mt-4 text-center text-sm text-slate-300">{message}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center glass-panel p-6 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <TrendingUp className="mr-2 w-6 h-6 text-brand-blue" />
            Your Lab History
          </h2>
          <p className="text-slate-300">Track your health markers over time.</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm font-medium text-slate-300 hover:text-white"
        >
          Sign Out
        </button>
      </div>

      {historyData.length === 0 ? (
        <div className="glass-panel p-8 rounded-2xl text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">No history found</h3>
          <p className="text-slate-300">Upload and save a lab report to start tracking your trends.</p>
        </div>
      ) : (
        <div className="glass-panel p-8 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-6">Marker Trends</h3>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {/* Dynamically generating a line for each unique key in the data except date */}
                {Object.keys(historyData[historyData.length - 1] || {})
                  .filter((key) => key !== "date")
                  .map((key, index) => (
                    <Line 
                      key={key} 
                      type="monotone" 
                      dataKey={key} 
                      stroke={`hsl(${(index * 137.5) % 360}, 70%, 50%)`} 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
