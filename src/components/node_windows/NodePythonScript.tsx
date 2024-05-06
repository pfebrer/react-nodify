import { useContext, useEffect, useState } from 'react'
import type { Node, NodeClass } from '../../interfaces'

import LogsWindow from '../LogsWindow'
import PythonApiContext from '../../apis/context'
import { FormControlLabel, Switch, TextField } from '@mui/material'

interface NodePythonScriptProps {
    node: Node,
    node_class?: NodeClass,
    divProps?: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>,
    style?: React.CSSProperties
}

const NodePythonScript = (props: NodePythonScriptProps) => {

    const [script, setScript] = useState("")
    const [includeDefaults, setIncludeDefaults] = useState(false)
    const [asFunction, setAsFunction] = useState(false)
    const [temporalFunctionName, setTemporalFunctionName] = useState("")
    const [functionName, setFunctionName] = useState("")

    const { node, node_class, ...other_props } = props

    const { pythonApi } = useContext(PythonApiContext)

    useEffect(() => {
        pythonApi.nodeToPythonScript(node.id, includeDefaults, asFunction, functionName).then((script) => {
            setScript(script as unknown as string)
        })
    }, [node.id, pythonApi, includeDefaults, asFunction, functionName])

    return <div>
        <div style={{display: "flex", paddingBottom: 10}}>
            <FormControlLabel label="Include defaults" control={<Switch checked={includeDefaults} onChange={(e) => {
                setIncludeDefaults(e.target.checked)
            }} />}/>
            <FormControlLabel label="As function" control={
                <Switch checked={asFunction} onChange={(e) => {
                    setAsFunction(e.target.checked)
                }} />} 
            />
            <TextField 
                label="Function name" 
                value={temporalFunctionName}
                onBlur={() => setFunctionName(temporalFunctionName)}
                disabled={!asFunction} 
                onChange={(e) => setTemporalFunctionName(e.target.value)}/>
        </div>
        <LogsWindow logs={script} language="python" {...other_props} />
    </div>
}

export { NodePythonScript }

export default NodePythonScript