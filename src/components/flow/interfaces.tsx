import { 
    XYPosition,
    Dimensions,
    Viewport as RFViewport
} from 'reactflow';

export type NodePosition = XYPosition
export type NodeDimension = Dimensions
export type Viewport = RFViewport


export interface NodePositions {
    [key: string]: XYPosition
}

export interface NodeDimensions {
    [key: string]: Dimensions
}