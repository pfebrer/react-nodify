import { createContext } from "react";
import { PythonApi } from "./PythonApi";

const PythonApiContext = createContext({pythonApi: new PythonApi(), setPythonApi: (api) => {}})

const PythonApiStatusContext = createContext(0)

export {PythonApiStatusContext, PythonApiContext}

export default PythonApiContext;
