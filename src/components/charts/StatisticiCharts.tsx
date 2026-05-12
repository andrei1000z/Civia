"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  accidenteLunare,
  accidentePeSector,
  sesizariTipuri,
  sesizariLunare,
  sesizariPeSector,
  aqiTrend30Zile,
  punctualitateSTB,
  calatoriMetrou,
  spatiiVerziPeSector,
  copaciInterventii,
} from "@/data/statistici";

const tooltipStyle = {
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "12px",
};

export function AccidenteLunareChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={accidenteLunare}>
        <defs>
          <linearGradient id="accidenteColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#DC2626" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" stroke="var(--color-text-muted)" fontSize={11} />
        <YAxis stroke="var(--color-text-muted)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--color-text)" }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#DC2626"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#accidenteColor)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AccidentePeSectorChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={accidentePeSector}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="sector" stroke="var(--color-text-muted)" fontSize={11} />
        <YAxis stroke="var(--color-text-muted)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill="#DC2626" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SesizariTipuriChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={sesizariTipuri}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={50}
          paddingAngle={2}
        >
          {sesizariTipuri.map((entry, i) => (
            <Cell key={i} fill={entry.culoare} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          wrapperStyle={{ fontSize: "11px" }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SesizariLunareChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={sesizariLunare}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" stroke="var(--color-text-muted)" fontSize={11} />
        <YAxis stroke="var(--color-text-muted)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Line type="monotone" dataKey="depuse" name="Depuse" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="rezolvate" name="Rezolvate" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SesizariPeSectorChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={sesizariPeSector} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis type="number" stroke="var(--color-text-muted)" fontSize={11} />
        <YAxis type="category" dataKey="sector" stroke="var(--color-text-muted)" fontSize={11} width={80} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AqiTrendChart() {
  if (aqiTrend30Zile.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-4 text-center">
        <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
          Nu avem încă acces la date per zi din API-ul ANPM/calitateaer.ro.
          Vezi valoarea actuală pe pagina <Link href="/aer" className="text-[var(--color-primary)] hover:underline">Calitate aer</Link>.
        </p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={aqiTrend30Zile}>
        <defs>
          <linearGradient id="aqiColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" stroke="var(--color-text-muted)" fontSize={10} />
        <YAxis stroke="var(--color-text-muted)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} fill="url(#aqiColor)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PunctualitateSTBChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={punctualitateSTB}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="linia" stroke="var(--color-text-muted)" fontSize={11} />
        <YAxis stroke="var(--color-text-muted)" fontSize={11} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
        <Bar dataKey="punctualitate" fill="#EAB308" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CalatoriMetrouChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={calatoriMetrou}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="linia" stroke="var(--color-text-muted)" fontSize={11} />
        <YAxis stroke="var(--color-text-muted)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="calatori" fill="#2563EB" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpatiiVerziChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={spatiiVerziPeSector}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="sector" stroke="var(--color-text-muted)" fontSize={11} />
        <YAxis stroke="var(--color-text-muted)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v} mp`} />
        <Bar dataKey="value" fill="#059669" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CopaciInterventiiChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={copaciInterventii}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="an" stroke="var(--color-text-muted)" fontSize={11} />
        <YAxis stroke="var(--color-text-muted)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Bar dataKey="plantati" name="Plantați" fill="#059669" radius={[4, 4, 0, 0]} />
        <Bar dataKey="taiati" name="Tăiați" fill="#DC2626" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
