"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function CompletionChart({ weekly }: { weekly: { week: string; completions: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={weekly} margin={{ top: 10, right: 8, left: -28, bottom: 0 }}>
        <defs><linearGradient id="coralGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f47f6b" stopOpacity={0.32} /><stop offset="100%" stopColor="#f47f6b" stopOpacity={0.02} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#eeeae4" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "#918b83", fontSize: 11 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#918b83", fontSize: 11 }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #ebe6df", boxShadow: "0 8px 24px rgba(47,43,38,.1)" }} />
        <Area type="monotone" dataKey="completions" stroke="#e96e5a" strokeWidth={2.5} fill="url(#coralGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
