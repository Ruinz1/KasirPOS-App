import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/utils/calculations";

interface SalesBarChartProps {
    chartData: any[];
    chartView: string;
}

/**
 * Grafik dipisah ke chunk sendiri: recharts berukuran besar (~370 kB), sehingga
 * kalau ikut di bundle halaman, Reports tidak bisa tampil sama sekali sebelum
 * library itu selesai diunduh — berat untuk device/jaringan lemah.
 */
export default function SalesBarChart({ chartData, chartView }: SalesBarChartProps) {
    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    angle={chartView === 'daily' ? -45 : 0}
                    textAnchor={chartView === 'daily' ? 'end' : 'middle'}
                    height={chartView === 'daily' ? 80 : 30}
                />
                <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                    }}
                />
                <Legend />
                <Bar dataKey="pendapatan" fill="#10b981" name="Pendapatan" radius={[3, 3, 0, 0]} />
                <Bar dataKey="hpp" fill="#f59e0b" name="HPP (Belanja)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gaji" fill="#f97316" name="Gaji" radius={[3, 3, 0, 0]} />
                <Bar dataKey="profit" fill="#3b82f6" name="Profit Bersih" radius={[3, 3, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
