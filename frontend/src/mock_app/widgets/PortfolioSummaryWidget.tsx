
import { useSimulationStore } from '../store/useSimulationStore';

const PortfolioSummaryWidget = () => {
    const { positions, instruments } = useSimulationStore();

    const stats = Object.values(positions).reduce((acc, pos) => {
        const netQty = pos.long - pos.short;
        const currentPx = instruments[pos.symbol]?.last || pos.cost;
        const pl = (currentPx - pos.cost) * netQty;

        // Mock Beta based on symbol
        const seed = pos.symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const beta = 0.5 + (seed % 100) / 50;
        const marketValue = netQty * currentPx;

        return {
            totalPL: acc.totalPL + pl,
            exposure: acc.exposure + Math.abs(marketValue),
            weightedBeta: acc.weightedBeta + (beta * Math.abs(marketValue))
        };
    }, { totalPL: 0, exposure: 0, weightedBeta: 0 });

    const cashBalance = 1000000;
    const netLiq = cashBalance + stats.totalPL;
    const portfolioBeta = stats.exposure > 0 ? stats.weightedBeta / stats.exposure : 0;

    return (
        <div className="h-full flex flex-col justify-center p-4 bg-[var(--bg-secondary)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-primary)] shadow-sm">
                    <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase mb-1">NET LIQUIDATION</div>
                    <div className="text-base md:text-xl font-bold text-[var(--text-primary)]">
                        ${Math.floor(netLiq).toLocaleString()}
                    </div>
                </div>
                <div className="bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-primary)] shadow-sm">
                    <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase mb-1">UNREALIZED P/L</div>
                    <div className={`text-base md:text-xl font-bold ${stats.totalPL >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                        {stats.totalPL >= 0 ? '+' : ''}${Math.floor(stats.totalPL).toLocaleString()}
                    </div>
                </div>
                <div className="bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-primary)] shadow-sm">
                    <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase mb-1">GROSS EXPOSURE</div>
                    <div className="text-base md:text-xl font-bold text-[var(--text-primary)]">
                        ${Math.floor(stats.exposure).toLocaleString()}
                    </div>
                </div>
                <div className="bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-primary)] shadow-sm">
                    <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase mb-1">PORTFOLIO BETA</div>
                    <div className="text-base md:text-xl font-bold text-[var(--accent-color)]">
                        {portfolioBeta.toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortfolioSummaryWidget;
