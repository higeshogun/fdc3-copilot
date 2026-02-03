
import RGL, { WidthProvider } from '@eleung/react-grid-layout';

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
    return (
        <ReactGridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={40} // Base row height
            width={1200} // Initial width, overwritten by WidthProvider
            draggableHandle=".draggable-handle"
            onLayoutChange={onLayoutChange}
            isDraggable={isDraggable}
            isResizable={isResizable}
            margin={[10, 10]}
            containerPadding={[10, 10]}
            compactType={null} // Free movement, or 'vertical' for gravity
        >
            {children}
        </ReactGridLayout>
    );
};

export default DraggableGrid;
