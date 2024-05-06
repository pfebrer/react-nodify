import React, { useEffect } from 'react';
//import './App.css';
//import "./styles/main.scss";

import { SessionLastUpdates, DefaultPyodideSettings, TabSpec } from "./interfaces"
import { PythonApi, PythonApiContext, PythonApiStatusContext } from './apis';
import { SessionLastUpdatesContext, SessionSynchronizer, TooltipsLevel, TooltipsLevelContext } from './context';
import {TabsWindow} from './TabsWindow';

interface GUIProps {
    default_pyodide_settings: DefaultPyodideSettings,
    tabs: TabSpec[]
}


function GUI(props: GUIProps) {

    const [pythonApi, setPythonApi] = React.useState<PythonApi>(new PythonApi({}))
    const [pythonApiStatus, setPythonApiStatus] = React.useState<PythonApi["status"]>(pythonApi.status)

    const [lastUpdates, setLastUpdates] = React.useState<SessionLastUpdates>({ nodes: 0., flows: 0., node_classes: 0. })

    const [tooltipsLevel, setTooltipsLevel] = React.useState<TooltipsLevel>("normal")

    useEffect(() => {
        pythonApi.onStatusChange = (status) => {
            setPythonApiStatus(status)
        }
        pythonApi.onReceiveLastUpdate((updates: any) => {
            setLastUpdates(updates)
        })
    }, [pythonApi])

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