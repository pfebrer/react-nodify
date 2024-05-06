import * as React from 'react';

import { useCallback, useContext, useEffect, useState, useMemo } from 'react';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import PropTypes from 'prop-types';

import { GitHub, LiveHelp, Wifi, WifiOff } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

import 'react-toastify/dist/ReactToastify.min.css';

import { Tooltip } from '@mui/material';
import FilePlotter from './components/windows/FilePlotter';
import FlowWindow from './components/windows/FlowWindow';
import NoBackendWindow from './components/windows/NoBackendWindow';
import { NavigatorContext } from './context/main_nav';
import { TooltipsLevelContext } from './context/tooltips';
import { PythonApiStatusContext, PythonApiContext } from './apis';
import { LogsWindow, NodeTerminal, SessionIO, NodeExplorer, BackendSettings, Iframe } from './components';


const AppTabs = styled(Tabs)({
    borderRightWidth: 0,
    '& .MuiTabs-indicator': {
        display: "none",
    },
});

const AppTab = styled(Tab)({
    borderRadius: 5,
    marginLeft: 2,
    marginRight: 2,
    marginTop: 10,
    marginBottom: 10,
    '&:hover': {
        backgroundColor: 'rgb(238, 242, 246)',
    },
    '&.Mui-selected': {
        backgroundColor: 'rgb(238, 242, 246)',
    },
    '&.Mui-focusVisible': {
        backgroundColor: '#d1eaff',
    },
})

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      style={{ flex: 1, overflow: "hidden"}}
      {...other}
    >
      {value === index && (
        <Box sx={{width: "100%", height: "100%"}}>
          {children}
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const panelTypes = {
    file_plotter: FilePlotter,
    node_explorer: NodeExplorer,
    flow: FlowWindow,
    iframe: Iframe,
    logs: LogsWindow,
}

const TabsWindow = (props) => {

    const {pythonApi} = useContext(PythonApiContext)
    const apiStatus = useContext(PythonApiStatusContext)

    const [value, setValue] = React.useState(props.tabs.length + 2);
    const [connected, setConnected] = useState(false)

    const [explorerTab, setExplorerTab] = useState(undefined)
    const [explorerNode, setExplorerNode] = useState(undefined)

    const seeNodeInExplorer = useCallback((node_id) => {
        if (explorerTab === undefined) return

        setValue(explorerTab)
        setExplorerNode(node_id)
    }, [explorerTab])

    useEffect(() => {
        pythonApi.onConnect(() => setConnected(true))
        pythonApi.onDisconnect(() => setConnected(false))
    }, [pythonApi])

    if (connected && value === props.tabs.length + 2) setValue(0)

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const goToBackendSettings = () => {
        setValue(props.tabs.length + 1)
    }

    const {tooltipsLevel, setTooltipsLevel} = useContext(TooltipsLevelContext)
    const tooltipsLevelColor = {"beginner": "green", "normal": undefined, "none": "#ccc"}[tooltipsLevel]

    const connectionTooltipColor = apiStatus <= 100 ? "red" : apiStatus < 200 ? "orange" : "green"
    var connectionTooltipTitle = "Connection status: " + (apiStatus <= 100 ? "Not connected" : apiStatus < 200 ? "Connecting..." : "Connected")
    if (tooltipsLevel === "beginner") {
        connectionTooltipTitle = <div style={{textAlign: "center"}}>
            <div>{connectionTooltipTitle}</div>
            { apiStatus <= 100 ? 
                <div>The graphical interface needs to be connected to some backend.
                You can pick the backend to connect at the home page or by clicking this icon.</div> 
                : null
            }

        </div>
    }

    const tabs = useMemo(() => {
        return props.tabs.map((tab, index) => <AppTab label={tab.label} {...a11yProps(index)} key={index}/>)
    }, [props.tabs])

    const tab_panels = (() => {
        return props.tabs.map((tab, index) => {

            const panelProps = tab.props || {}
            if (tab.type === "node_explorer") {
                if (explorerTab === undefined) setExplorerTab(index)
                panelProps.defaultNode = explorerNode
            }
            
            return <TabPanel value={value} index={index} key={index}>{panelTypes[tab.type](panelProps)}</TabPanel>
        })
    })()

    return (
        <NavigatorContext.Provider value={{seeNodeInExplorer}}>
        <Box
        sx={{ height: "100vh", display: "flex", flexDirection: "column"}}>
            <Box sx={{ bgcolor: "background.paper", display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 1 }}>
                <AppTabs
                orientation="horizontal"
                variant="scrollable"
                value={value}
                onChange={handleChange}
                aria-label="Main app tabs"
                sx={{ borderRight: 0, borderColor: 'divider'}}
                >
                    {...tabs}
                    <AppTab label="Terminal" {...a11yProps(tabs.length)} style={{display: pythonApi.allows_runpython ? undefined : "none"}} />
                    <AppTab label="Backend config" {...a11yProps(tabs.length + 1)} style={{display: "none"}} />
                    <AppTab label="No backend" {...a11yProps(tabs.length + 2)} style={{display: "none"}} />
                </AppTabs>

                
                <div style={{padding: 20, display: "flex", alignItems: "center"}}>
                <Tooltip title={`Go to Github development repository.`} arrow>
                    <IconButton 
                        href={"https://github.com/pfebrer/sisl-gui"}
                    >
                        <GitHub/>
                    </IconButton>
                    </Tooltip>
                    <Tooltip title={`Tooltips level: ${tooltipsLevel}. Click to change.`} arrow>
                    <IconButton 
                        style={{marginRight: 10}} 
                        onClick={() => setTooltipsLevel(tooltipsLevel === "normal" ? "beginner" : "normal")}
                        onDoubleClick={() => setTooltipsLevel("none")}
                    >
                        <LiveHelp style={{color: tooltipsLevelColor}}/>
                    </IconButton>
                    </Tooltip>
                    <SessionIO />
                    <Tooltip 
                        title={connectionTooltipTitle}
                        componentsProps={{
                            tooltip: {sx: { bgcolor: connectionTooltipColor,
                                '& .MuiTooltip-arrow': {color: connectionTooltipColor,},
                              },
                            },
                        }}
                        arrow>
                    <IconButton variant="outlined" color={apiStatus <= 100 ? "error" : apiStatus < 200 ? "warning" : "success" } onClick={goToBackendSettings}>
                        {pythonApi.connected ?  <Wifi /> : <WifiOff />}
                    </IconButton>
                    </Tooltip>

                </div>

            </Box>
            {...tab_panels}
            <TabPanel value={value} index={tabs.length}>
                <NodeTerminal style={{padding: 20}}/>
            </TabPanel>
            <TabPanel value={value} index={tabs.length + 1}>
                <BackendSettings default_pyodide_settings={props.default_pyodide_settings}/>
            </TabPanel>
            <TabPanel value={value} index={tabs.length + 2}>
                <NoBackendWindow goToBackendSettings={goToBackendSettings} default_pyodide_settings={props.default_pyodide_settings} />
            </TabPanel>
            {/* <ToastContainer/> */}
        </Box>
        </NavigatorContext.Provider>
    );
}

export { TabsWindow }
export default TabsWindow;