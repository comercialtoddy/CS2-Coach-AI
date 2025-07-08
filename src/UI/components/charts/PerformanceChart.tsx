import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface DataPoint {
  date: string;
  value: number;
  type: string;
}

interface PerformanceChartProps {
  data: DataPoint[];
  title?: string;
  yAxisLabel?: string;
  height?: number;
}

/**
 * Performance Chart Component
 * 
 * A reusable line chart component for displaying performance metrics over time.
 * Supports multiple metrics in the same chart with different colors.
 */
export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  title,
  yAxisLabel,
  height = 300
}) => {
  // Get unique metric types
  const metricTypes = Array.from(new Set(data.map(d => d.type)));

  // Colors for different metrics
  const colors = ['#60A5FA', '#34D399', '#F472B6', '#FBBF24'];

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-lg font-semibold mb-4">{title}</h4>
      )}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fill: '#9CA3AF' }
                    }
                  : undefined
              }
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
            {metricTypes.map((type, index) => (
              <Line
                key={type}
                type="monotone"
                dataKey="value"
                data={data.filter(d => d.type === type)}
                name={type}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}; 