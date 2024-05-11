import { useEffect, useState } from 'react';
//import './App.css';
//import "./styles/main.scss";

import { SessionLastUpdates, DefaultPyodideSettings, TabSpec } from "./interfaces"
import { PythonApi, PythonApiContext, PythonApiStatusContext, SocketPythonApi, PyodidePythonApi } from './apis';
import { SessionLastUpdatesContext, SessionSynchronizer, TooltipsLevel, TooltipsLevelContext } from './context';
import {TabsWindow} from './TabsWindow';

interface GUIProps {
    default_pyodide_settings: DefaultPyodideSettings,
    tabs: TabSpec[],
    backend: "socket" | "pyodide",
    backend_props: any
}


function GUI(props: GUIProps) {

    const [pythonApi, setPythonApi] = useState<PythonApi>(new PythonApi({}))
    const [pythonApiStatus, setPythonApiStatus] = useState<PythonApi["status"]>(pythonApi.status)

    const [lastUpdates, setLastUpdates] = useState<SessionLastUpdates>({ nodes: 0., flows: 0., node_classes: 0. })

    const [tooltipsLevel, setTooltipsLevel] = useState<TooltipsLevel>("normal")

    useEffect(() => {
        pythonApi.onStatusChange = (status) => {
            setPythonApiStatus(status)
        }
        pythonApi.onReceiveLastUpdate((updates: any) => {
            setLastUpdates(updates)
        })
    }, [pythonApi])

    useEffect(() => {
        var newpythonApi;
        if (props.backend === "socket") {
            newpythonApi = new SocketPythonApi(props.backend_props)
        } else if (props.backend === "pyodide") {
            newpythonApi = new PyodidePythonApi(props.backend_props)
        } else if (props.backend) {
            throw new Error(`Backend ${props.backend} not supported`)
        }

        if (newpythonApi) setPythonApi(newpythonApi)
    }, [props.backend, props.backend_props])

    return (
        <>
            <PythonApiStatusContext.Provider value={pythonApiStatus}>
                <PythonApiContext.Provider value={{ pythonApi, setPythonApi }}>
                    <SessionLastUpdatesContext.Provider value={lastUpdates}>
                        <SessionSynchronizer>
                            <TooltipsLevelContext.Provider value={{ tooltipsLevel, setTooltipsLevel }}>
                                <div className="App" style={{ display: "flex", flexDirection: "column" }}>
                                    <div className="appContent" style={{ height: "100vh" }}>
                                        <TabsWindow 
                                            default_pyodide_settings={props.default_pyodide_settings}
                                            tabs={props.tabs}
                                        />
                                    </div>
                                </div>
                            </TooltipsLevelContext.Provider>
                        </SessionSynchronizer>
                    </SessionLastUpdatesContext.Provider>
                </PythonApiContext.Provider>
            </PythonApiStatusContext.Provider>
        </>
    );
}

export { GUI }

export default GUI;