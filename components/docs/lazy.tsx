"use client";

// Code-split the interactive lab components. They still render on the server,
// but their JavaScript loads in separate chunks so the first slide hydrates sooner.
import dynamic from "next/dynamic";

export const SimTerminal = dynamic(() => import("./sim-terminal").then((m) => m.SimTerminal));
export const RecordSession = dynamic(() =>
  import("./record-session").then((m) => m.RecordSession),
);
export const NoiseLab = dynamic(() => import("./noise-lab").then((m) => m.NoiseLab));
export const YamlExplorer = dynamic(() => import("./yaml-explorer").then((m) => m.YamlExplorer));
export const AgentLab = dynamic(() => import("./agent-lab").then((m) => m.AgentLab));
export const GlyphTide = dynamic(() =>
  import("@/components/ui/background-ascii-plasma").then((m) => m.GlyphTide),
);
