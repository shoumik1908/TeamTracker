import React from 'react';

export default function ParticleBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Base Gradient: Deep royal purple to electric blue on near black */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/30 via-[#0a0514] to-[#020106]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_var(--tw-gradient-stops))] from-blue-600/15 via-transparent to-transparent"></div>
      
      {/* High-fidelity Dot & Line Particle Network */}
      <div className="absolute inset-0 overflow-hidden opacity-70">
        <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient cx="50%" cy="50%" id="glow-purple" r="50%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8"></stop>
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0"></stop>
            </radialGradient>
            <radialGradient cx="50%" cy="50%" id="glow-blue" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8"></stop>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"></stop>
            </radialGradient>
          </defs>
          {/* Lines Network */}
          <g fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.75">
            {/* Left Web */}
            <path d="M 5% 15% L 18% 28% L 10% 45% L 22% 58% L 18% 28%"></path>
            <path d="M 10% 45% L -5% 55%"></path>
            <path d="M 22% 58% L 15% 75% L 28% 85% L 35% 70% L 15% 75%"></path>
            <path d="M 28% 85% L 12% 95%"></path>
            {/* Center Web */}
            <path d="M 35% 20% L 48% 32% L 42% 50% L 55% 65% L 48% 32%"></path>
            <path d="M 42% 50% L 32% 55% L 22% 58%"></path>
            <path d="M 55% 65% L 45% 82% L 62% 88% L 68% 72% L 45% 82%"></path>
            <path d="M 48% 32% L 65% 25% L 75% 42% L 68% 58% L 65% 25%"></path>
            <path d="M 68% 58% L 55% 65%"></path>
            {/* Right Web */}
            <path d="M 85% 12% L 75% 28% L 88% 42% L 78% 60% L 75% 28%"></path>
            <path d="M 88% 42% L 98% 35%"></path>
            <path d="M 78% 60% L 85% 78% L 72% 88% L 62% 75% L 85% 78%"></path>
            <path d="M 85% 78% L 95% 85%"></path>
            <path d="M 68% 58% L 78% 60%"></path>
          </g>
          {/* Nodes (Dots with glow and pulse) */}
          {/* Left Nodes */}
          <g className="node-pulse-slow" style={{ transformOrigin: "5% 15%" }}><circle cx="5%" cy="15%" fill="url(#glow-blue)" r="3"></circle><circle cx="5%" cy="15%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-med" style={{ transformOrigin: "18% 28%" }}><circle cx="18%" cy="28%" fill="url(#glow-purple)" r="4"></circle><circle cx="18%" cy="28%" fill="#fff" r="1.5"></circle></g>
          <g className="node-pulse-fast" style={{ transformOrigin: "10% 45%" }}><circle cx="10%" cy="45%" fill="url(#glow-blue)" r="2.5"></circle><circle cx="10%" cy="45%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-slow" style={{ transformOrigin: "22% 58%" }}><circle cx="22%" cy="58%" fill="url(#glow-purple)" r="3.5"></circle><circle cx="22%" cy="58%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-med" style={{ transformOrigin: "15% 75%" }}><circle cx="15%" cy="75%" fill="url(#glow-blue)" r="3"></circle><circle cx="15%" cy="75%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-fast" style={{ transformOrigin: "28% 85%" }}><circle cx="28%" cy="85%" fill="url(#glow-purple)" r="4"></circle><circle cx="28%" cy="85%" fill="#fff" r="1.5"></circle></g>
          <g className="node-pulse-slow" style={{ transformOrigin: "35% 70%" }}><circle cx="35%" cy="70%" fill="url(#glow-blue)" r="2.5"></circle><circle cx="35%" cy="70%" fill="#fff" r="1"></circle></g>
          {/* Center Nodes */}
          <g className="node-pulse-med" style={{ transformOrigin: "35% 20%" }}><circle cx="35%" cy="20%" fill="url(#glow-purple)" r="3"></circle><circle cx="35%" cy="20%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-fast" style={{ transformOrigin: "48% 32%" }}><circle cx="48%" cy="32%" fill="url(#glow-blue)" r="4.5"></circle><circle cx="48%" cy="32%" fill="#fff" r="1.5"></circle></g>
          <g className="node-pulse-slow" style={{ transformOrigin: "42% 50%" }}><circle cx="42%" cy="50%" fill="url(#glow-purple)" r="3"></circle><circle cx="42%" cy="50%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-med" style={{ transformOrigin: "55% 65%" }}><circle cx="55%" cy="65%" fill="url(#glow-blue)" r="4"></circle><circle cx="55%" cy="65%" fill="#fff" r="1.5"></circle></g>
          <g className="node-pulse-fast" style={{ transformOrigin: "45% 82%" }}><circle cx="45%" cy="82%" fill="url(#glow-purple)" r="2.5"></circle><circle cx="45%" cy="82%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-slow" style={{ transformOrigin: "62% 88%" }}><circle cx="62%" cy="88%" fill="url(#glow-blue)" r="3.5"></circle><circle cx="62%" cy="88%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-med" style={{ transformOrigin: "68% 72%" }}><circle cx="68%" cy="72%" fill="url(#glow-purple)" r="3"></circle><circle cx="68%" cy="72%" fill="#fff" r="1"></circle></g>
          {/* Right Nodes */}
          <g className="node-pulse-fast" style={{ transformOrigin: "65% 25%" }}><circle cx="65%" cy="25%" fill="url(#glow-blue)" r="3.5"></circle><circle cx="65%" cy="25%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-slow" style={{ transformOrigin: "75% 42%" }}><circle cx="75%" cy="42%" fill="url(#glow-purple)" r="4"></circle><circle cx="75%" cy="42%" fill="#fff" r="1.5"></circle></g>
          <g className="node-pulse-med" style={{ transformOrigin: "68% 58%" }}><circle cx="68%" cy="58%" fill="url(#glow-blue)" r="3"></circle><circle cx="68%" cy="58%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-fast" style={{ transformOrigin: "85% 12%" }}><circle cx="85%" cy="12%" fill="url(#glow-purple)" r="2.5"></circle><circle cx="85%" cy="12%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-slow" style={{ transformOrigin: "75% 28%" }}><circle cx="75%" cy="28%" fill="url(#glow-blue)" r="4"></circle><circle cx="75%" cy="28%" fill="#fff" r="1.5"></circle></g>
          <g className="node-pulse-med" style={{ transformOrigin: "88% 42%" }}><circle cx="88%" cy="42%" fill="url(#glow-purple)" r="3"></circle><circle cx="88%" cy="42%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-fast" style={{ transformOrigin: "78% 60%" }}><circle cx="78%" cy="60%" fill="url(#glow-blue)" r="3.5"></circle><circle cx="78%" cy="60%" fill="#fff" r="1"></circle></g>
          <g className="node-pulse-slow" style={{ transformOrigin: "85% 78%" }}><circle cx="85%" cy="78%" fill="url(#glow-purple)" r="4"></circle><circle cx="85%" cy="78%" fill="#fff" r="1.5"></circle></g>
          <g className="node-pulse-med" style={{ transformOrigin: "72% 88%" }}><circle cx="72%" cy="88%" fill="url(#glow-blue)" r="2.5"></circle><circle cx="72%" cy="88%" fill="#fff" r="1"></circle></g>
          {/* Loose Nodes */}
          <g className="node-pulse-fast" style={{ transformOrigin: "32% 55%" }}><circle cx="32%" cy="55%" fill="url(#glow-purple)" r="2"></circle><circle cx="32%" cy="55%" fill="#fff" r="0.8"></circle></g>
          <g className="node-pulse-slow" style={{ transformOrigin: "62% 75%" }}><circle cx="62%" cy="75%" fill="url(#glow-blue)" r="2"></circle><circle cx="62%" cy="75%" fill="#fff" r="0.8"></circle></g>
        </svg>
      </div>
    </div>
  );
}
