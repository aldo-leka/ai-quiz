import { useState, useEffect } from 'react';

interface GameTimerProps {
  timer: number;
}

export default function GameTimer({ timer }: GameTimerProps) {
  // If timer is -1, this indicates an untimed quiz, so don't render anything
  if (timer === -1) {
    return null;
  }
  
  return (
    <div className="bg-white text-indigo-800 px-3 py-1 rounded-full font-bold">
      {timer}s
    </div>
  );
}