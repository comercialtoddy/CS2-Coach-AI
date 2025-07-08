import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface DataPoint {
  name: string;
  value: number;
  type?: string;
}

interface BarChartProps {
  data: DataPoint[];
  title?: string;
  yAxisLabel?: string;
  height?: number;
  horizontal?: boolean;
}

/**
 * Bar Chart Component
 * 
 * A reusable bar chart component for displaying comparative data
 * like weapon usage or map win rates.
 */
export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  yAxisLabel,
  height = 300,
  horizontal = false
}) => {
  // Get unique metric types
  const metricTypes = Array.from(new Set(data.map(d => d.type).filter(Boolean)));
  const hasTypes = metricTypes.length > 0;

  // Colors for different metrics
  const colors = ['#60A5FA', '#34D399', '#F472B6', '#FBBF24'];

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-lg font-semibold mb-4">{title}</h4>
      )}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <RechartsBarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type={horizontal ? 'number' : 'category'}
              dataKey={horizontal ? undefined : 'name'}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis
              type={horizontal ? 'category' : 'number'}
              dataKey={horizontal ? 'name' : undefined}
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
            {hasTypes ? (
              <>
                <Legend wrapperStyle={{ color: '#9CA3AF' }} />
                {metricTypes.map((type, index) => (
                  <Bar
                    key={type}
                    dataKey="value"
                    data={data.filter(d => d.type === type)}
                    name={type}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </>
            ) : (
              <Bar
                dataKey="value"
                fill="#60A5FA"
                name={title || 'Value'}
              />
            )}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}; 