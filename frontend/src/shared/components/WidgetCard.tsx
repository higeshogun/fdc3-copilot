
import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';

interface WidgetCardProps {
    widgetId?: string;
    title: React.ReactNode;
    children: React.ReactNode;
    onClose?: () => void;
    onCollapse?: (widgetId: string, isCollapsed: boolean) => void;
    className?: string;
    headerActions?: React.ReactNode;
    style?: React.CSSProperties;
    // Passed by React-Grid-Layout
    onMouseDown?: React.MouseEventHandler;
    onMouseUp?: React.MouseEventHandler;
    onTouchEnd?: React.TouchEventHandler;
}

const WidgetCard = React.forwardRef<HTMLDivElement, WidgetCardProps>(
    ({ widgetId, title, children, onClose, onCollapse, className = '', headerActions, style, ...props }, ref) => {
        const [isCollapsed, setIsCollapsed] = useState(false);

        return (
            <div
                ref={ref}
                style={style}
                className={`widget-card flex flex-col glass-panel rounded-md overflow-hidden ${className} ${isCollapsed ? 'collapsed' : ''
                    }`}
                {...props}
            >
                <div className="widget-header flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)] select-none bg-[var(--bg-tertiary)]">
                    <div className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-2 cursor-move draggable-handle">
                        <GripVertical size={16} className="md:hidden text-[var(--text-secondary)] flex-shrink-0" />
                        {title}
                    </div>
                    <div className="flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
                        {headerActions}
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newCollapsedState = !isCollapsed;
                                setIsCollapsed(newCollapsedState);
                                if (onCollapse && widgetId) {
                                    onCollapse(widgetId, newCollapsedState);
                                }
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            style={{ touchAction: 'none' }}
                            title={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-colors"
                                title="Close"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div
                    className={`widget-content overflow-auto relative bg-[var(--bg-secondary)] transition-all duration-300 ${isCollapsed ? 'h-0 opacity-0' : 'flex-grow opacity-100'
                        }`}
                >
                    {children}
                </div>
            </div>
        );
    }
);

export default WidgetCard;
