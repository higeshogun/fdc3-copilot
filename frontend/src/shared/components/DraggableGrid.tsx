
import RGL, { WidthProvider } from '@eleung/react-grid-layout';
import { useState, useEffect } from 'react';

export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
}


const ReactGridLayout = WidthProvider(RGL);

interface DraggableGridProps {
    layout: Layout[];
    children: React.ReactNode;
    onLayoutChange: (layout: Layout[]) => void;
    isDraggable?: boolean;
    isResizable?: boolean;
}

const DraggableGrid: React.FC<DraggableGridProps> = ({
    layout,
    children,
    onLayoutChange,
    isDraggable = true,
    isResizable = true
}) => {
    const [cols, setCols] = useState(12);

    useEffect(() => {
        const updateCols = () => {
            const width = window.innerWidth;
            if (width >= 1200) {
                setCols(12);
            } else if (width >= 768) {
                setCols(6);
            } else if (width >= 480) {
                setCols(2);
            } else {
                setCols(1);
            }
        };

        updateCols();
        window.addEventListener('resize', updateCols);
        return () => window.removeEventListener('resize', updateCols);
    }, []);

    return (
        <ReactGridLayout
            className="layout"
            layout={layout}
            cols={cols}
            rowHeight={40}
            width={1200}
            draggableHandle=".draggable-handle"
            onLayoutChange={onLayoutChange}
            isDraggable={isDraggable}
            isResizable={isResizable}
            margin={[10, 10]}
            containerPadding={[10, 10]}
            compactType="vertical"
        >
            {children}
        </ReactGridLayout>
    );
};

export default DraggableGrid;
