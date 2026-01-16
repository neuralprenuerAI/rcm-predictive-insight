import React from "react";
import { format, parseISO } from "date-fns";

interface DataPoint {
  date: string;
  count: number;
}

interface SimpleChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  showLabels?: boolean;
}

export function SimpleChart({ 
  data, 
  color = "#3b82f6", 
  height = 200,
  showLabels = true 
}: SimpleChartProps) {
  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const barWidth = 100 / data.length;

  return (
    <div className="w-full">
      {/* Chart Area */}
      <div 
        className="relative flex items-end gap-[2px]" 
        style={{ height }}
      >
        {data.map((point, index) => {
          const barHeight = (point.count / maxCount) * 100;
          return (
            <div
              key={point.date}
              className="relative flex-1 group"
              style={{ maxWidth: `${barWidth}%` }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                <div className="bg-popover text-popover-foreground px-2 py-1 rounded text-xs shadow-lg whitespace-nowrap border">
                  {format(parseISO(point.date), "MMM d")}: {point.count}
                </div>
              </div>
              
              {/* Bar */}
              <div
                className="w-full rounded-t transition-all duration-200 group-hover:opacity-80"
                style={{
                  backgroundColor: color,
                  height: `${barHeight}%`,
                  minHeight: point.count > 0 ? "4px" : "2px",
                }}
              />
            </div>
          );
        })}
      </div>
      
      {/* X-axis labels */}
      {showLabels && data.length <= 14 && (
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{format(parseISO(data[0].date), "MMM d")}</span>
          <span>{format(parseISO(data[data.length - 1].date), "MMM d")}</span>
        </div>
      )}
    </div>
  );
}

export default SimpleChart;
