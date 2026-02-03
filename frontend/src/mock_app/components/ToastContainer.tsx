import { useSimulationStore } from '../store/useSimulationStore';
import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react';

const ToastContainer = () => {
    const { toasts, removeToast } = useSimulationStore();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-3 max-w-sm w-full">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
                        flex items-center gap-3 p-4 rounded-lg shadow-2xl border backdrop-blur-md animate-slide-in-left
                        ${toast.type === 'success' ? 'bg-[var(--success-color)]/20 border-[var(--success-color)]/50 text-[var(--success-color)]' : ''}
                        ${toast.type === 'info' ? 'bg-[var(--accent-color)]/20 border-[var(--accent-color)]/50 text-[var(--accent-color)]' : ''}
                        ${toast.type === 'warning' ? 'bg-[var(--warning-color)]/20 border-[var(--warning-color)]/50 text-[var(--warning-color)]' : ''}
                        ${toast.type === 'error' ? 'bg-[var(--danger-color)]/20 border-[var(--danger-color)]/50 text-[var(--danger-color)]' : ''}
                    `}
                >
                    <div className="flex-shrink-0">
                        {toast.type === 'success' && <CheckCircle size={20} className="text-green-400" />}
                        {toast.type === 'info' && <Info size={20} className="text-blue-400" />}
                        {toast.type === 'warning' && <AlertTriangle size={20} className="text-yellow-400" />}
                        {toast.type === 'error' && <XCircle size={20} className="text-red-400" />}
                    </div>
                    <div className="flex-grow text-sm font-medium">
                        {toast.message}
                    </div>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="flex-shrink-0 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>

                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 h-1 bg-current opacity-30 animate-shrink-width" style={{ animationDuration: '5000ms' }} />
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
