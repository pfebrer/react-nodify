async function worker() {

// webworker.js

// Setup your project to serve `py-worker.js`. You should also serve
// `pyodide.js`, and all its associated `.asm.js`, `.json`,
// and `.wasm` files as well:
importScripts("https://cdn.jsdelivr.net/pyodide/dev/full/pyodide.js");

state = {
    status: 100,
}

function setStatus(status) {
    state.status = status
    self.postMessage({type: "status", status: status})
}

async function micropipInstall(packages, keep_going=false, deps=true) {
    return this.micropip.install(packages, keep_going, deps)
}

async function loadPackages(packages) {
    return pyodide.loadPackage(packages)
}

async function loadRuntime(packages=[], micropipPackages=[], init_script="") {

    setStatus(101)

    let pyodide = await loadPyodide()

    globalThis.pyodide = pyodide

    setStatus(102)

    const pypi_packages = pyodide.loadPackage("micropip").then(() => {
        console.log("Importing micropip")
        const micropip = pyodide.pyimport("micropip")
        console.log("Imported micropip")
        globalThis.micropip = micropip

        return Promise.all([
            micropip.install("nodify"),
            micropip.install(micropipPackages || [])
        ])
    })

    const pyodidePackages = Promise.all([
        pyodide.loadPackage(packages || []),
        //pyodide.loadPackage('./sisl-0.9.8.dev2240+g8abff51ce4-cp312-cp312-emscripten_3_1_52_wasm32.whl')
    ])

    await pyodidePackages
    await pypi_packages

    setStatus(103)

    pyodide.runPython(init_script)

    await sendLastUpdate()

    setStatus(200)

}

async function sendLastUpdate() {
    const session = pyodide.globals.get("session")

    globalThis.session = session

    return self.postMessage({type: "last_update", last_update: session.last_update.toJs({dict_converter: Object.fromEntries})})
}

async function applyMethod(methodName, args, kwargs) {
    console.log("APPLYING METHOD", methodName, kwargs, args)

    const py_args = (args || []).map(arg => pyodide.toPy(arg))
    const py_kwargs = {}
    Object.keys(kwargs || {}).forEach(key => {py_kwargs[key] = pyodide.toPy(kwargs[key])})

    const ret = await session[methodName].callKwargs(...py_args, py_kwargs)

    sendLastUpdate()

    return ret
}

async function runPython(code) {

    await pyodide.loadPackagesFromImports(code)
    const result = pyodide.runPython(code)
    sendLastUpdate()

    return result
}

// Helper function that writes a file to the virtual filesystem
async function writeFile(file){
    const file_arr = await file.arrayBuffer()
    pyodide.FS.writeFile(file.name, new Uint8Array(file_arr))
}

async function writeFiles(files) {

    // Write all files to the virtual filesystem)
    const promises = Object.values(files).map(writeFile);
    // Wait for all files to be written
    await Promise.all(promises)

}

self.onmessage = async (event) => {

    console.log("MESSAGE", event.data)

    if (event.data.type === "loadRuntime") {
        await loadRuntime(event.data.packages || [], event.data.micropipPackages || [], event.data.init_script || "")
    } else if (event.data.type === "sessionMethod") {
        const {methodName, args, kwargs} = event.data

        const ret = await applyMethod(methodName, args, kwargs)

        const for_js = pyodide.globals.get("_nodify_for_js")

        try {
            event.ports[0].postMessage({return: for_js(ret)})
        } catch (e) {
            try {
                event.ports[0].postMessage({return: for_js(ret).toJs({dict_converter: Object.fromEntries})})
            } catch {
                event.ports[0].postMessage({return: null})
            } 
        }
        
    } else if (event.data.type === "last_update") {
        await sendLastUpdate()
    } else if (event.data.type === "runPython") {

        const result = await runPython(event.data.code)
        event.ports[0].postMessage({result: result.toString()})
        
    } else if (event.data.type === "writeFiles") {
        await writeFiles(event.data.files)

        event.ports[0].postMessage({done: true})
    } else if (event.data.type === "loadPackages") {
        await loadPackages(event.data.packages)
        event.ports[0].postMessage({done: true})
    } else if (event.data.type === "micropipInstall") {
        await micropipInstall(event.data.packages, event.data.keep_going, event.data.deps)
        event.ports[0].postMessage({done: true})
    }
}
}

export { worker }
