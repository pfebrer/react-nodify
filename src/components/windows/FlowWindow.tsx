import { useCallback, useContext, useMemo, useState, useEffect} from 'react';
import { ReactFlowProvider } from 'reactflow';

import { Paper } from '@mui/material';

import { Node } from '../../interfaces';
import { NodeDimensions, NodePositions, NodePosition, NodeDimension, Viewport } from '../../components/flow/interfaces';
import { FlowsContext, NodeClassesRegistryContext, NodesContext } from '../../context';
import { Flow, NewNodesSideBar, TopControlsBar } from '../flow';
import { PythonApiContext } from '../../apis';

interface FlowState {
    visibleNodes: number[],
    nodePositions: {[key: string]: NodePosition},
    nodeDimensions: {[key: string]: NodeDimension},
    nodeExpanded: {[key: string]: boolean},
    nodeOutputVisible: {[key: string]: boolean},
    fixedPositions: {[key: string]: NodePosition},
    fixedDimensions: {[key: string]: NodeDimension},
}

const FlowWindow = () => {
    const [selectedNodes, setSelectedNodes] = useState<number[]>([])
    const [outputNodeId, setOutputNodeId] = useState<number | null>(null)
    const [newNodePosition, setNewNodePosition] = useState<NodePosition | undefined>(undefined)

    const {pythonApi} = useContext(PythonApiContext)

    // Top toolbar
    const [showConstants, setShowConstants] = useState(true)

    // React flow control
    const [flowState, setFlowState] = useState<FlowState>({
        visibleNodes: [],
        nodePositions: {},
        nodeDimensions: {},
        nodeExpanded: {},
        nodeOutputVisible: {},
        fixedPositions: {},
        fixedDimensions: {},
    })
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined)

    const { visibleNodes, nodePositions, nodeDimensions, nodeExpanded, nodeOutputVisible, fixedPositions, fixedDimensions } = flowState

    const setVisibleNodes = (func: (nodes: number[]) => number[]) => setFlowState((state) => ({...state, visibleNodes: func(state.visibleNodes)}))
    const setNodePositions = (func: (positions: NodePositions) => NodePositions) => setFlowState((state) => ({...state, nodePositions: func(state.nodePositions)}))
    const setNodeDimensions = (func: (dimensions: NodeDimensions) => NodeDimensions) => setFlowState((state) => ({...state, nodeDimensions: func(state.nodeDimensions)}))
    const setNodeExpanded = (func: (expanded: {[key: string]: boolean}) => {[key: string]: boolean}) => setFlowState((state) => ({...state, nodeExpanded: func(state.nodeExpanded)}))
    const setNodeOutputVisible = (func: (output_visible: {[key: string]: boolean}) => {[key: string]: boolean}) => setFlowState((state) => ({...state, nodeOutputVisible: func(state.nodeOutputVisible)}))
    const setFixedPositions = (positions: NodePositions) => setFlowState((state) => ({...state, fixedPositions: positions}))
    const setFixedDimensions = (dimensions: NodeDimensions) => setFlowState((state) => ({...state, fixedDimensions: dimensions}))

    const { node_classes } = useContext(NodeClassesRegistryContext)
    const nodes = useContext(NodesContext)
    const { flows, setFlows, flowsFromServer } = useContext(FlowsContext)

    const [synced, setSynced] = useState(false)
    const [initialized, setInitialized] = useState(false)

    // Function to set unknown heights for some nodes. This is needed
    // when we expand/collapse the node, so that we tell react-flow
    // that the height must be recalculated.
    const setUnknownHeights = useCallback((node_ids?: string[]) => {

        setNodeDimensions((nds) => {

            node_ids = node_ids || Object.keys(nds)

            const unknown_heights = node_ids.reduce((acc: any, key) => {
                if (nds[key] && nds[key].height) acc[key] = {height: undefined, width: nds[key].width}
                return acc
            }, {})
            
            return {...nds, ...unknown_heights}
        })
    }, [])


    // --------------------------------------------------
    //    FUNCTIONS TO SYNC THE STATE WITH THE SERVER
    // --------------------------------------------------
    const syncFromServer = useCallback(() => {
        if (initialized && !flowsFromServer) return
        if (!flows) return

        if (nodes && flows["0"]) {

            const dimensions = flows["0"].dimensions || {}
            setFlowState({
                visibleNodes: flows["0"].nodes || [],
                nodePositions: flows["0"].positions || {},
                nodeDimensions: flows["0"].dimensions || {},
                nodeExpanded: flows["0"].expanded || {},
                nodeOutputVisible: flows["0"].output_visible || {},
                fixedPositions: flows["0"].positions || {},
                fixedDimensions: Object.keys(dimensions).reduce((acc: {[key: string]: {width: number, height: number}}, key: string) => {
                    acc[key] = {width: dimensions[key].width, height: undefined as unknown as number}
                    return acc
                }, {}),
            })
            setViewport(flows["0"].viewport || {x: 0, y: 0, zoom: 1})
        }
        
        setInitialized(true)
        setSynced(true)

    }, [flows, flowsFromServer, nodes, initialized])

    const syncToServer = useCallback(() => {
        setFlows(
            {"0": {nodes: visibleNodes, positions: fixedPositions, dimensions: fixedDimensions, expanded: nodeExpanded, output_visible: nodeOutputVisible, viewport: viewport}}
        )
    }, [setFlows, visibleNodes, fixedPositions, fixedDimensions, nodeExpanded, nodeOutputVisible, viewport])

    useEffect(() => {
        syncFromServer()
    }, [syncFromServer])

    useEffect(() => {
        if (initialized && !synced) syncToServer()
    }, [syncToServer, synced, initialized])

    // Nodes that will actually show in the flow pane
    const flow_nodes = useMemo(() => {
        if (showConstants) return visibleNodes
        return visibleNodes.filter((node_id) => nodes[node_id] && node_classes[nodes[node_id].node.class].name !== "ConstantNode")
    }, [visibleNodes, showConstants, nodes, node_classes])

    
    // ----------------------------------------------
    //      HANDLERS FOR THE SIDE CONTROL BAR
    // ----------------------------------------------

    const initConnectedNode = useCallback((node_class_id: number, nodeToConnect: number, connectInto: string) => {

        const node_class = node_classes[node_class_id]
        if (!node_class) return
        const parameter = node_class.parameters[connectInto]
        if (!parameter) return

        const inputValue = parameter.kind === "VAR_POSITIONAL" ? [nodeToConnect] : nodeToConnect

        pythonApi.initNode(node_class_id, {[connectInto]: inputValue}, {[connectInto]: "NODE"}).then((new_node) => {

            setOutputNodeId(null)
            setFlowState((state) => ({
                ...state,
                visibleNodes: [...state.visibleNodes, (new_node as unknown as Node).id],
                nodePositions: {...state.nodePositions, [(new_node as unknown as Node).id]: newNodePosition || {x: 3, y: 3}},
                fixedPositions: {...state.fixedPositions, [(new_node as unknown as Node).id]: newNodePosition || {x: 3, y: 3}},
            }))
            setSynced(false)
        })
    }, [newNodePosition, pythonApi, node_classes])

    const handleExistingNodeClick = useCallback((node_id: number) => {
        setVisibleNodes((nodes) => [...nodes, node_id])
        setSynced(false)
    }, [])

    // ----------------------------------------------
    //        HANDLERS FOR THE TOP CONTROL BAR
    // ----------------------------------------------

    const handleHideSelected = useCallback(() => {
        setVisibleNodes((nds) => nds.filter((id) => !selectedNodes.includes(id)))
        setSelectedNodes([])
        setSynced(false)
    }, [selectedNodes])

    const handleHideNodes = useCallback((nodes: number[]) => {
        setVisibleNodes((nds) => nds.filter((id) => !nodes.includes(id)))
        setSynced(false)
    }, [])

    const handleShowNodes = useCallback((nodes: number[]) => {
        setVisibleNodes((nds) => [...nds, ...nodes.filter((id) => !nds.includes(id))])
        setSynced(false)
    }, [])

    // ----------------------------------------------
    //        HANDLERS FOR THE FLOW PANE
    // ----------------------------------------------

    const handleOutputDrop = useCallback((node_id: number, position: NodePosition, e?: MouseEvent | TouchEvent) => {
        setOutputNodeId(node_id)
        setNewNodePosition(position)
        setSynced(false)
    }, [])

    const handleInputDrop = useCallback((node_id: number, input_key: string, position: NodePosition, e?: MouseEvent | TouchEvent) => {
        pythonApi.nodeInputToNode(node_id, input_key, undefined).then((new_node) => {
            setFlowState((state) => ({
                ...state,
                visibleNodes: [...state.visibleNodes, (new_node as unknown as Node).id],
                nodePositions: {...state.nodePositions, [(new_node as unknown as Node).id]: position},
                fixedPositions: {...state.fixedPositions, [(new_node as unknown as Node).id]: position},
            }))
            setSynced(false)
        })
    }, [pythonApi])

    const handleNodeRemove = useCallback((node_ids: number[]) => {
        node_ids.forEach((node_id) => {
            if (!nodes[node_id]) return

            pythonApi.removeNode(node_id).then(() => {
                setVisibleNodes((nds) => nds.filter((id) => id !== node_id))
                setSelectedNodes((nds) => nds.filter((id) => id !== node_id))
                setSynced(false)
            })
        })
    }, [nodes, pythonApi])

    const handleNodeSelection = useCallback((changes: {[key: string]: boolean}) => {
        const newlyselectedNodes = Object.keys(changes).filter((key) => changes[key]).map(Number)
        const newlyunSelectedNodes = Object.keys(changes).filter((key) => !changes[key]).map(Number)

        setSelectedNodes((nds) => {
            return [...nds.filter((id) => !newlyunSelectedNodes.includes(id)), ...newlyselectedNodes]
        })
    }, [])

    const handleChangeNodePosition = useCallback((changes: NodePositions, relayout?: boolean) => {


        if (relayout){
            setFlowState((state) => ({...state, nodePositions: {...state.nodePositions, ...changes}, fixedPositions: {...state.nodePositions, ...changes}}))
            setSynced(false)
        } else {
            setNodePositions((nds) => ({...nds, ...changes}))
        }
        
    }, [])

    const handleEndNodePosition = useCallback((dropped: number[]) => {
        setFixedPositions(nodePositions)
        setSynced(false)
    }, [nodePositions])

    const handleEndNodeDimensions = useCallback((changed: number[]) => {
        setFixedDimensions(nodeDimensions)
        setSynced(false)
    }, [nodeDimensions])

    const handleNodeExpanded = useCallback((changes: any) => {
        setNodeExpanded((nds) => ({...nds, ...changes}))
        setSynced(false)
        setUnknownHeights(Object.keys(changes))
        
    }, [setUnknownHeights])

    const handleNodeOutputToggle = useCallback((changes: any) => {
        setNodeOutputVisible((nds) => ({...nds, ...changes}))
        setSynced(false)
        setUnknownHeights(Object.keys(changes))
    }, [setUnknownHeights])

    const handleViewPortChange = useCallback((viewport: Viewport) => {
        setViewport(viewport)
        setSynced(false)
    }, [])

    return <div style={{display: "flex", height: "100%"}}>
        <Paper sx={{margin: 1, boxSizing: "border-box"}} elevation={4}>
        <NewNodesSideBar
            style={{
                backgroundColor: "whitesmoke",
                marginTop: 0,
                minWidth: 300,
                height: "100%"
            }}
            nodes={nodes}
            visibleNodes={visibleNodes}
            outputNodeId={outputNodeId}
            onRemoveNodeId={() => setOutputNodeId(null)}
            newNodePosition={newNodePosition}
            onExistingNodeClick={handleExistingNodeClick}
            onConnectedNodeClick={initConnectedNode}
        />
        </Paper>
        <div style={{flex: 1, height: "100%", display: "flex", flexDirection: "column"}}>
            <TopControlsBar 
                nodes={nodes}
                selectedNodes={selectedNodes}
                showConstants={showConstants}
                onShowConstantsChange={setShowConstants}
                onHideSelected={handleHideSelected}
                onHideNodes={handleHideNodes}
                onShowNodes={handleShowNodes}
            />
            <ReactFlowProvider>
            {initialized && <Flow
                defaultViewport={viewport}
                nodes={nodes}
                flow_nodes={flow_nodes}
                nodePositions={nodePositions}
                onChangeNodePosition={handleChangeNodePosition}
                onEndNodePosition={handleEndNodePosition}
                nodeDimensions={nodeDimensions}
                onChangeNodeDimensions={(changes) => setNodeDimensions((nds) => ({...nds, ...changes}))}
                onEndNodeDimensions={handleEndNodeDimensions}
                nodeOutputVisible={nodeOutputVisible}
                onNodeOutputToggle={handleNodeOutputToggle}
                selectedNodes={selectedNodes}
                onNodeSelection={handleNodeSelection}
                nodeExpanded={nodeExpanded}
                onNodeExpanded={handleNodeExpanded}
                onNodeRemove={handleNodeRemove}
                onOutputDrop={handleOutputDrop}
                onInputDrop={handleInputDrop}
                onMoveEnd={handleViewPortChange}
                />}
            </ReactFlowProvider>
        </div>
        
    </div>
}

export { FlowWindow }

export default FlowWindow;