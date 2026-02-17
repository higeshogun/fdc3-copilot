import { useState, useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { API_BASE_URL } from '../config';

interface AccountData {
    cashBalance: number;
    netLiquidation: number;
    buyingPower: number;
    excessLiquidity: number;
    currency: string;
    accountId: string;
}

const AccountBalanceWidget = () => {
    const { connectionStatus } = useSimulationStore();
    const [accountData, setAccountData] = useState<AccountData | null>(null);
    const [loading, setLoading] = useState(true);
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (!connectionStatus.gateway) {
            setLoading(false);
            return;
        }

        const fetchAccountData = async () => {
            // ... existing fetch logic uses localError now ...
            try {
                setLoading(true);
                const response = await fetch(`${API_BASE_URL}/mcp/account`);
                const data = await response.json();

                if (data.error) {
                    setLocalError(data.error);
                    setLoading(false);
                    return;
                }

                // Parse IBKR account summary format
                const summary = data.summary || {};
                const accountId = data.account_id || 'Unknown';

                // Extract key metrics from IBKR response
                const cashBalance = summary.totalcashvalue?.amount || summary['totalcashvalue-s']?.amount || 0;
                const netLiquidation = summary['netliquidation-s']?.amount || summary.netliquidation?.amount || 0;
                const buyingPower = summary.buyingpower?.amount || summary['buyingpower-s']?.amount || 0;
                const excessLiquidity = summary.excessliquidity?.amount || summary['excessliquidity-s']?.amount || 0;
                const currency = summary.totalcashvalue?.currency || summary['totalcashvalue-s']?.currency || 'USD';

                setAccountData({
                    cashBalance,
                    netLiquidation,
                    buyingPower,
                    excessLiquidity,
                    currency,
                    accountId
                });
                setLocalError(null);
            } catch (err) {
                setLocalError(err instanceof Error ? err.message : 'Failed to fetch account data');
            } finally {
                setLoading(false);
            }
        };

        fetchAccountData();
        const interval = setInterval(fetchAccountData, 30000);
        return () => clearInterval(interval);
    }, [connectionStatus.gateway]);

    if (!connectionStatus.gateway) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 bg-[var(--bg-secondary)] text-center space-y-2">
                <div className="p-3 bg-red-500/10 rounded-full text-red-500 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /><line x1="23" y1="1" x2="1" y2="23" /></svg>
                </div>
                <div className="text-[var(--text-primary)] font-bold text-sm">IBKR GATEWAY DISCONNECTED</div>
                <div className="text-[var(--text-secondary)] text-xs max-w-[200px]">
                    Account balance is unavailable while the gateway is offline.
                </div>
            </div>
        );
    }

    if (loading && !accountData) {
        return (
            <div className="h-full flex items-center justify-center p-4 bg-[var(--bg-secondary)]">
                <div className="text-[var(--text-secondary)]">Loading account data...</div>
            </div>
        );
    }

    if (localError) {
        return (
            <div className="h-full flex items-center justify-center p-4 bg-[var(--bg-secondary)]">
                <div className="text-center">
                    <div className="text-[var(--text-secondary)] text-sm mb-2">
                        Unable to fetch IBKR account data
                    </div>
                    <div className="text-[var(--text-tertiary)] text-xs">
                        {localError}
                    </div>
                    <div className="text-[var(--text-tertiary)] text-xs mt-2">
                        Make sure IBKR Gateway is authenticated at https://localhost:5000
                    </div>
                </div>
            </div>
        );
    }

    if (!accountData) {
        return null;
    }

    const formatCurrency = (amount: number, currency: string) => {
        return `${currency} ${Math.floor(amount).toLocaleString()}`;
    };

    return (
        <div className="h-full flex flex-col justify-center p-4 bg-[var(--bg-secondary)]">
            <div className="mb-3 flex items-center justify-between">
                <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase">
                    IBKR Account: {accountData.accountId}
                </div>
                <div className="text-[var(--accent-color)] text-[9px]">
                    ● Live
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-primary)] shadow-sm">
                    <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase mb-1">
                        NET LIQUIDATION
                    </div>
                    <div className="text-base md:text-xl font-bold text-[var(--text-primary)]">
                        {formatCurrency(accountData.netLiquidation, accountData.currency)}
                    </div>
                </div>

                <div className="bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-primary)] shadow-sm">
                    <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase mb-1">
                        CASH BALANCE
                    </div>
                    <div className="text-base md:text-xl font-bold text-[var(--text-primary)]">
                        {formatCurrency(accountData.cashBalance, accountData.currency)}
                    </div>
                </div>

                <div className="bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-primary)] shadow-sm">
                    <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase mb-1">
                        BUYING POWER
                    </div>
                    <div className="text-base md:text-xl font-bold text-[var(--success-color)]">
                        {formatCurrency(accountData.buyingPower, accountData.currency)}
                    </div>
                </div>

                <div className="bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-primary)] shadow-sm">
                    <div className="text-[var(--text-secondary)] text-[10px] font-bold uppercase mb-1">
                        EXCESS LIQUIDITY
                    </div>
                    <div className="text-base md:text-xl font-bold text-[var(--accent-color)]">
                        {formatCurrency(accountData.excessLiquidity, accountData.currency)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountBalanceWidget;
