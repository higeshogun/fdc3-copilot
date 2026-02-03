
import React from 'react';
import { X } from 'lucide-react';

interface WidgetCardProps {
    title: React.ReactNode;
    children: React.ReactNode;
    onClose?: () => void;
    className?: string;
    headerActions?: React.ReactNode;
    style?: React.CSSProperties;
    // Passed by React-Grid-Layout
    onMouseDown?: React.MouseEventHandler;
    onMouseUp?: React.MouseEventHandler;
    onTouchEnd?: React.TouchEventHandler;
}

const WidgetCard = React.forwardRef<HTMLDivElement, WidgetCardProps>(
    ({ title, children, onClose, className = '', headerActions, style, ...props }, ref) => {
        return (
            <div
                ref={ref}
                style={style}
                className={`widget-card flex flex-col glass-panel rounded-md overflow-hidden ${className}`}
                {...props}
            >
                <div className="widget-header flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)] cursor-move draggable-handle select-none bg-[var(--bg-tertiary)]">
                    <div className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-2">
                        {/* Icon or Handle could go here */}
                        {title}
                    </div>
                    <div className="flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
                        {headerActions}
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="widget-content flex-grow overflow-auto relative bg-[var(--bg-secondary)]">
                    {children}
                </div>
            </div>
        );
    }
);

export default WidgetCard;
