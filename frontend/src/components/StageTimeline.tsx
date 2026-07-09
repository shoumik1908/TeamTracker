import { Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StageTimelineProps {
  opportunityName: string;
  stages: string[];
  currentStageIndex: number;
  onStageClick: (stageName: string, stageIndex: number) => void;
}

export default function StageTimeline({
  opportunityName,
  stages,
  currentStageIndex,
  onStageClick,
}: StageTimelineProps) {
  const currentStage = stages[currentStageIndex];
  const isTerminalCompleted = currentStageIndex === stages.length - 1;
  const isWon = currentStage?.toLowerCase().includes('won') || isTerminalCompleted;
  const isLost = currentStage?.toLowerCase().includes('lost');

  const themeColorClass = isWon
    ? 'bg-emerald-500 text-white ring-emerald-500 shadow-emerald-500/20'
    : isLost
    ? 'bg-red-500 text-white ring-red-500 shadow-red-500/20'
    : 'bg-azure-500 text-white ring-azure-500 shadow-azure-500/20';

  const themeTextClass = isWon
    ? 'text-emerald-400'
    : isLost
    ? 'text-red-400'
    : 'text-azure-400';

  const connectorActiveColorClass = isWon
    ? 'bg-emerald-500'
    : isLost
    ? 'bg-red-500'
    : 'bg-azure-500';

  // Split stages into Row 1 (left-to-right) and Row 2 (right-to-left)
  const half = Math.ceil(stages.length / 2);
  const row1 = stages.slice(0, half);
  const row2 = stages.slice(half);

  const isVerticalConnectorActive = currentStageIndex >= half;

  const isSingleRow = stages.length <= 6;

  if (isSingleRow) {
    return (
      <div className="w-full">
        {/* Scrollable container for responsiveness */}
        <div className="overflow-x-auto pb-8 pt-2 scrollbar-thin">
          <div className="relative min-w-[760px] md:min-w-0 md:w-full px-8 flex items-center justify-between">
            {stages.map((stage, idx) => {
              const isCompleted = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isUpcoming = idx > currentStageIndex;
              const isLast = idx === stages.length - 1;

              // Horizontal connector (extends to the right)
              const isConnectorActive = idx < currentStageIndex;
              const connectorColor = isConnectorActive ? connectorActiveColorClass : 'bg-border';

              return (
                <div key={idx} className="relative flex-1 flex flex-col items-center">
                  
                  {/* Horizontal Line Connector (extends to right) */}
                  {!isLast && (
                    <div
                      className={cn(
                        'absolute top-3 left-1/2 w-full h-[2px] z-0 transition-all duration-500 ease-in-out',
                        connectorColor
                      )}
                    />
                  )}

                  {/* Node */}
                  <button
                    onClick={() => onStageClick(stage, idx)}
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
                      isCompleted && 'bg-zinc-800 border-azure-500/50 hover:bg-zinc-700/80 hover:border-azure-500 text-azure-400',
                      isCurrent && cn('ring-2 animate-fade-in shadow-md scale-105 font-bold', themeColorClass, 'border-background'),
                      isUpcoming && 'bg-zinc-900 border-border hover:border-muted-foreground/60 text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={`Move ${opportunityName} to ${stage}`}
                    title={isCurrent ? `Current stage: ${stage}` : `Move to ${stage}`}
                  >
                    {isCompleted ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : isCurrent ? (
                      isWon ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : isLost ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <span className="text-[10px]">{idx + 1}</span>
                      )
                    ) : (
                      <span className="text-[10px]">{idx + 1}</span>
                    )}
                  </button>

                  {/* Label */}
                  <div
                    className={cn(
                      'absolute top-8 whitespace-nowrap text-center text-[9px] font-semibold tracking-wide transition-colors duration-200 pointer-events-none z-10',
                      isCurrent ? themeTextClass : isCompleted ? 'text-foreground/80' : 'text-muted-foreground'
                    )}
                  >
                    {stage}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Scrollable container for responsiveness */}
      <div className="overflow-x-auto pb-10 pt-2 scrollbar-thin">
        <div className="relative min-w-[760px] md:min-w-0 md:w-full px-8 flex flex-col gap-8">
          
          {/* ROW 1: Left to Right */}
          <div className="flex items-center w-full relative z-10">
            {row1.map((stage, idx) => {
              const isCompleted = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isUpcoming = idx > currentStageIndex;
              const isLastInRow = idx === row1.length - 1;

              // Horizontal connector (extends to the right)
              const isConnectorActive = idx < currentStageIndex;
              const connectorColor = isConnectorActive ? connectorActiveColorClass : 'bg-border';

              return (
                <div key={idx} className="relative w-1/6 flex flex-col items-center">
                  
                  {/* Horizontal Line Connector (extends to right) */}
                  {!isLastInRow && (
                    <div
                      className={cn(
                        'absolute top-3 left-1/2 w-full h-[2px] z-0 transition-all duration-500 ease-in-out',
                        connectorColor
                      )}
                    />
                  )}

                  {/* Vertical Bend Connector (Row 1, Stage 6 to Row 2, Stage 7) */}
                  {isLastInRow && row2.length > 0 && (
                    <div
                      className={cn(
                        'absolute top-3 left-1/2 w-[2px] h-[56px] -translate-x-1/2 z-0 transition-all duration-500 ease-in-out',
                        isVerticalConnectorActive ? connectorActiveColorClass : 'bg-border'
                      )}
                    />
                  )}

                  {/* Node */}
                  <button
                    onClick={() => onStageClick(stage, idx)}
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
                      isCompleted && 'bg-zinc-800 border-azure-500/50 hover:bg-zinc-700/80 hover:border-azure-500 text-azure-400',
                      isCurrent && cn('ring-2 animate-fade-in shadow-md scale-105 font-bold', themeColorClass, 'border-background'),
                      isUpcoming && 'bg-zinc-900 border-border hover:border-muted-foreground/60 text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={`Move ${opportunityName} to ${stage}`}
                    title={isCurrent ? `Current stage: ${stage}` : `Move to ${stage}`}
                  >
                    {isCompleted ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : isCurrent ? (
                      isWon ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : isLost ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <span className="text-[10px]">{idx + 1}</span>
                      )
                    ) : (
                      <span className="text-[10px]">{idx + 1}</span>
                    )}
                  </button>

                  {/* Label */}
                  <div
                    className={cn(
                      'absolute top-8 whitespace-nowrap text-center text-[9px] font-semibold tracking-wide transition-colors duration-200 pointer-events-none z-10',
                      isCurrent ? themeTextClass : isCompleted ? 'text-foreground/80' : 'text-muted-foreground'
                    )}
                  >
                    {stage}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ROW 2: Right to Left */}
          <div className="flex flex-row-reverse items-center w-full relative z-10">
            {row2.map((stage, idx) => {
              const actualIdx = half + idx;
              const isCompleted = actualIdx < currentStageIndex;
              const isCurrent = actualIdx === currentStageIndex;
              const isUpcoming = actualIdx > currentStageIndex;
              const isLastInRow = idx === row2.length - 1;

              // Horizontal connector (extends to the left)
              const isConnectorActive = actualIdx < currentStageIndex;
              const connectorColor = isConnectorActive ? connectorActiveColorClass : 'bg-border';

              return (
                <div key={actualIdx} className="relative w-1/6 flex flex-col items-center">
                  
                  {/* Horizontal Line Connector (extends to left) */}
                  {!isLastInRow && (
                    <div
                      className={cn(
                        'absolute top-3 right-1/2 w-full h-[2px] z-0 transition-all duration-500 ease-in-out',
                        connectorColor
                      )}
                    />
                  )}

                  {/* Node */}
                  <button
                    onClick={() => onStageClick(stage, actualIdx)}
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
                      isCompleted && 'bg-zinc-800 border-azure-500/50 hover:bg-zinc-700/80 hover:border-azure-500 text-azure-400',
                      isCurrent && cn('ring-2 animate-fade-in shadow-md scale-105 font-bold', themeColorClass, 'border-background'),
                      isUpcoming && 'bg-zinc-900 border-border hover:border-muted-foreground/60 text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={`Move ${opportunityName} to ${stage}`}
                    title={isCurrent ? `Current stage: ${stage}` : `Move to ${stage}`}
                  >
                    {isCompleted ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : isCurrent ? (
                      isWon ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : isLost ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <span className="text-[10px]">{actualIdx + 1}</span>
                      )
                    ) : (
                      <span className="text-[10px]">{actualIdx + 1}</span>
                    )}
                  </button>

                  {/* Label */}
                  <div
                    className={cn(
                      'absolute top-8 whitespace-nowrap text-center text-[9px] font-semibold tracking-wide transition-colors duration-200 pointer-events-none z-10',
                      isCurrent ? themeTextClass : isCompleted ? 'text-foreground/80' : 'text-muted-foreground'
                    )}
                  >
                    {stage}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
