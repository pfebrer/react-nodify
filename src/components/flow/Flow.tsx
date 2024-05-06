import ReactFlow, {
    Controls,
    ControlButton,
    Background,
    Node as ReactFlowNode,
    useReactFlow,
    XYPosition,
    Viewport
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useCallback, useContext, useMemo, useRef} from 'react';

import { AccountTree } from '@mui/icons-material';

import { Node } from '../../interfaces';
import { NodeDimensions, NodePositions } from './interfaces';

import { FlowConstantNode, FlowNode } from './Nodes';
import { NodeClassesRegistryContext } from '../../context';
import { dagreLayout } from './layout_utils';
import { PythonApiContext } from '../../apis';

interface FlowProps {
    defaultViewport?: Viewport,
    nodes: { [key: number]: { node: Node, name: string } },
    flow_nodes: number[],
    nodePositions: NodePositions,
    nodeDimensions: NodeDimensions,
    nodeExpanded: { [key: string]: boolean },
    nodeOutputVisible: { [key: string]: boolean },
    selectedNodes?: number[],
    onNodeClick?: (node_id: number) => void,
    onNodeSelection?: (changes: { [key: string]: boolean }) => void,
    onNodeExpanded?: (changes: { [key: string]: boolean }) => void,
    onNodeOutputToggle?: (changes: { [key: string]: boolean }) => void,
    onNodeRemove?: (node_ids: number[]) => void,
    onOutputDrop?: (node_id: number, position: XYPosition, e?: MouseEvent | TouchEvent) => void,
    onInputDrop?: (node_id: number, input_key: string, position: XYPosition, e?: MouseEvent | TouchEvent) => void,
    onChangeNodePosition?: (changes: NodePositions, relayout?: boolean) => void,
    onEndNodePosition?: (dropped: number[]) => void,
    onChangeNodeDimensions?: (changes: NodeDimensions) => void,
    onEndNodeDimensions?: (changed: number[]) => void,
    onMoveEnd?: (viewport: Viewport) => void,
}

const Flow = (props: FlowProps) => {

    const { screenToFlowPosition } = useReactFlow();

    const { pythonApi } = useContext(PythonApiContext)
    const connectingInput = useRef<{ node_id: number | null, input_name: string | null }>({ node_id: null, input_name: null });

    const { node_classes } = useContext(NodeClassesRegistryContext)
    const nodes = props.nodes

    const {
        flow_nodes,
        selectedNodes,
        nodeDimensions,
        nodePositions,
        nodeExpanded,
        nodeOutputVisible,
        onEndNodePosition,
        onChangeNodePosition,
        onChangeNodeDimensions,
        onEndNodeDimensions,
        onNodeRemove,
        onNodeSelection,
        onNodeExpanded,
        onNodeOutputToggle
    } = props

    const initialflowNodes: ReactFlowNode[] = useMemo(() => {

        return flow_nodes.map(node_id => {

            // if (!shouldShowNode(node, node_class)) return
            if (!nodes[node_id]) return null

            const { node, name } = nodes[node_id]
            const node_class = node_classes[node.class]

            if (!node_class) return null

            const expanded = nodeExpanded[node_id] || false
            const outputVisible = nodeOutputVisible[node_id] || false

            return {
                id: String(node_id),
                type: { "ConstantNode": "constant" }[node_class.name] || "custom" as string,
                position: nodePositions[node_id] || { x: 3, y: 3 },
                width: nodeDimensions[node_id]?.width, //This is just so that reactflow doesn't hide the node
                height: nodeDimensions[node_id]?.height, //nodeDimensions[node_id]?.height || 20, //This is just so that reactflow doesn't hide the node
                style: nodeDimensions[node_id] || {},
                selected: (selectedNodes || []).includes(node_id),
                hidden: false,
                data: {
                    name: name,
                    node: node,
                    node_class: node_class,
                    expanded: expanded,
                    outputVisible: outputVisible,
                    onExpand: () => onNodeExpanded && onNodeExpanded({ [node_id]: !expanded }),
                    onOutputToggle: () => onNodeOutputToggle && onNodeOutputToggle({ [node_id]: !outputVisible }),
                },
            }

        }).filter((node) => node !== null) as ReactFlowNode[]

    }, [flow_nodes, nodes, node_classes, onNodeExpanded, nodePositions, nodeDimensions, selectedNodes, nodeExpanded, nodeOutputVisible, onNodeOutputToggle])

    const initialflowEdges = useMemo(() => {

        const edges: any[] = []

        const styles = (node_input_id: number) => {

            if (!nodes[node_input_id]) return {}

            const node = nodes[node_input_id].node

            if (node_classes[node.class] && node_classes[node.class].name === "ConstantNode") return { stroke: 'purple', strokeWidth: 2 }
            if (node.errored) return { stroke: '#FF0072', strokeWidth: 2 }
            if (node.outdated) return { stroke: '#FFD300', strokeWidth: 2 }
            else return { stroke: 'green', strokeWidth: 2 }

        }

        flow_nodes.forEach(node_id => {

            if (!nodes[node_id]) return

            const { node } = nodes[node_id]
            const node_class = node_classes[node.class]

            Object.keys(node.inputs_mode).forEach((input_name, i) => {
                if (node.inputs_mode[input_name] === "NODE")
                    if (node_class.parameters[input_name].kind === "VAR_POSITIONAL") {
                        node.inputs[input_name].forEach((input_node_id: number) => {
                            if (!flow_nodes.includes(input_node_id)) return
                            edges.push({
                                id: `${input_node_id}$$${node_id}$$${input_name}`,
                                source: String(input_node_id),
                                target: String(node_id),
                                targetHandle: input_name,
                                style: styles(input_node_id)
                            })
                        })
                    } else {
                        if (!flow_nodes.includes(node.inputs[input_name])) return
                        edges.push({
                            id: `${node.inputs[input_name]}$$${node_id}$$${input_name}`,
                            source: String(node.inputs[input_name]),
                            target: String(node_id),
                            targetHandle: input_name,
                            style: styles(node.inputs[input_name])
                        })
                    }
            })
        })

        return edges

    }, [flow_nodes, nodes, node_classes])

    const onNodesChange = useCallback(
        (changes: any) => {
            if (changes[0].type === "position") {

                const dragged_positions = changes.reduce((acc: { [key: string]: XYPosition }, change: any) => {
                    if (change.type === "position" && change.position && change.dragging) acc[change.id] = change.position
                    return acc
                }, {})

                if (Object.keys(dragged_positions).length > 0) onChangeNodePosition && onChangeNodePosition(dragged_positions)

                const dropped_positions = changes.reduce((acc: number[], change: any) => {
                    if (change.type === "position" && change.dragging === false) acc.push(Number(change.id))
                    return acc
                }, [])

                if (dropped_positions.length > 0) onEndNodePosition && onEndNodePosition(dropped_positions)

            } else if (changes[0].type === "dimensions") {

                const all_dimensions = changes.reduce((acc: { [key: string]: { width: number, height: number } }, change: any) => {
                    if (change.type === "dimensions" && change.resizing !== false) acc[change.id] = change.dimensions
                    return acc
                }, {})

                if (Object.keys(all_dimensions).length > 0) onChangeNodeDimensions && onChangeNodeDimensions(all_dimensions)

                const finished_resizing = changes.reduce((acc: number[], change: any) => {
                    if (change.type === "dimensions" && change.resizing === false) acc.push(Number(change.id))
                    return acc
                }, [])

                if (finished_resizing.length > 0) onEndNodeDimensions && onEndNodeDimensions(finished_resizing)
            } else if (changes[0].type === "select") {

                const selected = changes.reduce((acc: { [key: string]: boolean }, change: any) => {
                    if (change.type === "select") acc[change.id] = change.selected
                    return acc
                }, {})

                onNodeSelection && onNodeSelection(selected)
            } else if (changes[0].type === "remove") {
                const toRemove = changes.filter((change: any) => change.type === "remove").map((change: any) => Number(change.id))
                onNodeRemove && onNodeRemove(toRemove)
            }
        },
        [onEndNodePosition, onChangeNodePosition, onChangeNodeDimensions, onNodeSelection, onNodeRemove, onEndNodeDimensions],
    );

    const onEdgesChange = useCallback(
        (changes: any) => {
            if (changes[0].type === "remove") {
                const [source_id, node_id, input_name] = changes[0].id.split("$$")
                const node = nodes[Number(node_id)].node
                const param = node_classes[node.class].parameters[input_name]

                if (param.kind === "VAR_POSITIONAL" && node.inputs[param.name].length > 1) {
                    const newVal = node.inputs[param.name].filter((id: number) => id !== Number(source_id))
                    pythonApi.updateNodeInputs(Number(node_id), { [input_name]: newVal }, { [input_name]: "NODE" })
                } else {
                    pythonApi.resetNodeInputs(Number(node_id), [input_name])
                }

            }

        }, [node_classes, nodes, pythonApi]
    );
    const onConnect = useCallback((params: any) => {

        const { source, target, targetHandle } = params;

        const node = nodes[Number(target)].node
        const param = node_classes[node.class].parameters[targetHandle]

        var newVal;

        if (!param) {
            newVal = Number(source)
            return pythonApi.updateNodeInputs(Number(target), { obj: newVal }, { obj: "NODE" })
        } else if (param.kind === "VAR_POSITIONAL") {
            if (node.inputs[param.name] && node.inputs_mode[param.name] === "NODE") {
                newVal = [...node.inputs[param.name], Number(source)]
            } else {
                newVal = [Number(source)]
            }
        } else {
            newVal = Number(source)
        }

        pythonApi.updateNodeInputs(Number(target), { [targetHandle]: newVal }, { [targetHandle]: "NODE" })

    }, [nodes, node_classes, pythonApi]);

    const onConnectStart = useCallback((e: any, params: any) => {
        connectingInput.current = { node_id: Number(params.nodeId), input_name: params.handleId }
    }, []);

    const onInputDrop = props.onInputDrop
    const onOutputDrop = props.onOutputDrop

    const onConnectEnd = useCallback((e: MouseEvent | TouchEvent) => {

        const position = screenToFlowPosition(
            { x: (e as MouseEvent).clientX || 3, y: (e as MouseEvent).clientY || 3 }
        )

        const connectedInput = { ...connectingInput.current }
        if (connectedInput.node_id === null || connectedInput.input_name === null) return
        connectingInput.current = { node_id: null, input_name: null }

        const targetIsPane = e.target && e.target instanceof HTMLElement && e.target.classList.contains("react-flow__pane")

        if (targetIsPane) {
            if (connectedInput.input_name === "output") {
                onOutputDrop && onOutputDrop(connectedInput.node_id, position)
            } else {
                onInputDrop && onInputDrop(connectedInput.node_id, connectedInput.input_name, position)
            }
        }

    }, [screenToFlowPosition, onOutputDrop, onInputDrop]);

    const nodeTypes = useMemo(() => ({ custom: FlowNode, constant: FlowConstantNode, }), []);

    const handleLayoutClick = () => {
        props.onChangeNodePosition && props.onChangeNodePosition(dagreLayout(initialflowNodes, initialflowEdges, { direction: "LR" }), true)
    }

    return (
        <div style={{ flex: 1 }}>
            <ReactFlow
                defaultViewport={props.defaultViewport}
                nodes={initialflowNodes}
                edges={initialflowEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectEnd={onConnectEnd}
                onConnectStart={onConnectStart}
                nodeTypes={nodeTypes}
                onMoveEnd={(_, data) => props.onMoveEnd && props.onMoveEnd(data)}
            >
                <Background />
                <Controls>
                    <ControlButton onClick={handleLayoutClick} title='Layout tree'>
                        <AccountTree />
                    </ControlButton>
                </Controls>
            </ReactFlow>
        </div>
    );
}

export { Flow }