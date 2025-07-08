import React from 'react';
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';

interface DataPoint {
  subject: string;
  value: number;
  fullMark: number;
}

interface RadarChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
}

/**
 * Radar Chart Component
 * 
 * A reusable radar chart component for displaying multi-dimensional stats
 * like weapon proficiency or map performance.
 */
export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  title,
  height = 300
}) => {
  return (
    <div className="w-full">
      {title && (
        <h4 className="text-lg font-semibold mb-4">{title}</h4>
      )}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <RechartsRadarChart
            cx="50%"
            cy="50%"
            outerRadius="80%"
            data={data}
          >
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#9CA3AF' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#9CA3AF' }}
            />
            <Radar
              name="Performance"
              dataKey="value"
              stroke="#60A5FA"
              fill="#60A5FA"
              fillOpacity={0.6}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '0.5rem'
              }}
              labelStyle={{ color: '#9CA3AF' }}
              itemStyle={{ color: '#E5E7EB' }}
            />
            <Legend
              wrapperStyle={{ color: '#9CA3AF' }}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}; 