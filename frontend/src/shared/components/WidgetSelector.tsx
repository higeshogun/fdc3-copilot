import React from 'react';
import { X } from 'lucide-react';

interface WidgetSelectorProps {
    availableWidgets: { id: string; name: string }[];
    visibleWidgets: Set<string>;
    onToggleWidget: (widgetId: string) => void;
    onClose: () => void;
}

const WidgetSelector: React.FC<WidgetSelectorProps> = ({
    availableWidgets,
    visibleWidgets,
    onToggleWidget,
    onClose
}) => {
    const handleSelectAll = () => {
        availableWidgets.forEach(widget => {
            if (!visibleWidgets.has(widget.id)) {
                onToggleWidget(widget.id);
            }
        });
    };

    const handleDeselectAll = () => {
        availableWidgets.forEach(widget => {
            if (visibleWidgets.has(widget.id)) {
                onToggleWidget(widget.id);
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="glass-panel rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Widget Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-[var(--text-secondary)] hover:text-[var(--text-accent)] transition-colors"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-4">
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                        Select which widgets to display on your dashboard
                    </p>

                    {/* Quick Actions */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={handleSelectAll}
                            className="px-3 py-1.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] border border-[var(--border-primary)] transition-colors"
                        >
                            Select All
                        </button>
                        <button
                            onClick={handleDeselectAll}
                            className="px-3 py-1.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] border border-[var(--border-primary)] transition-colors"
                        >
                            Deselect All
                        </button>
                    </div>

                    {/* Widget List */}
                    <div className="space-y-2">
                        {availableWidgets.map(widget => (
                            <label
                                key={widget.id}
                                className="flex items-center gap-3 p-3 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-primary)] cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={visibleWidgets.has(widget.id)}
                                    onChange={() => onToggleWidget(widget.id)}
                                    className="w-4 h-4 rounded border-[var(--border-primary)] text-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-color)]"
                                />
                                <span className="text-sm font-medium text-[var(--text-primary)]">
                                    {widget.name}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
                    {visibleWidgets.size} of {availableWidgets.length} widgets visible
                </div>
            </div>
        </div>
    );
};

export default WidgetSelector;
