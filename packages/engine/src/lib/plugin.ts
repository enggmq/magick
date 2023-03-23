import { FC, LazyExoticComponent } from "react"
import { Handler } from "koa/lib/application"
import { CompletionProvider, MagickComponent } from "./types"
import { MagickComponentArray } from "./magick-component"

export type PluginSecret = {
  name: string
  key: string
  global?: boolean
  getUrl?: string
}

export type PluginDrawerItem = {
  path: string
  icon: FC
  text: string
}

export type PluginClientRoute = {
  path: string
  component: FC
  exact?: boolean
}

export type PluginServerRoute = {
  path: string
  method: string
  handler: Handler
}

type PluginConstuctor = {
  name: string
  nodes?: MagickComponentArray
  inputTypes?: any[]
  outputTypes?: any[]
  secrets?: PluginSecret[]
  completionProviders?: any[]
}
class Plugin {
  name: string
  nodes: MagickComponentArray
  inputTypes: any[]
  outputTypes: any[]
  secrets: PluginSecret[] = []
  completionProviders: any[] = []
  constructor({
    name,
    nodes = [],
    inputTypes = [],
    outputTypes = [],
    secrets = [],
    completionProviders = [],
  }: PluginConstuctor) {
    this.name = name
    this.nodes = nodes
    this.inputTypes = inputTypes
    this.outputTypes = outputTypes
    this.secrets = secrets
    this.completionProviders = completionProviders
  }
}

export class ClientPlugin extends Plugin {
  agentComponents: FC[]
  drawerItems?: Array<PluginDrawerItem>
  clientPageLayout?: LazyExoticComponent<() => JSX.Element> | null
  clientRoutes?: Array<PluginClientRoute>
  constructor({
    name,
    nodes = [],
    agentComponents = [],
    inputTypes = [],
    outputTypes = [],
    clientPageLayout = null,
    clientRoutes = [],
    drawerItems = [],
    secrets = [],
    completionProviders = [],
  }: PluginConstuctor & {
    agentComponents?: FC[]
    clientPageLayout?: LazyExoticComponent<() => JSX.Element> | null
    clientRoutes?: Array<PluginClientRoute>
    drawerItems?: Array<PluginDrawerItem>
  }) {
    super({
      name,
      nodes,
      inputTypes,
      outputTypes,
      secrets,
      completionProviders,
    })
    this.clientPageLayout = clientPageLayout
    this.agentComponents = agentComponents
    this.clientRoutes = clientRoutes
    this.drawerItems = drawerItems
    pluginManager.register(this)
  }
}

export class ServerPlugin extends Plugin {
  services: any
  serverInit?: Function
  agentMethods?: {
    start: Function
    stop: Function
  }
  serverRoutes?: Array<PluginServerRoute>
  constructor({
    name,
    nodes = [],
    services = [],
    inputTypes = [],
    outputTypes = [],
    serverInit = () => null,
    agentMethods = {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      start: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      stop: () => {},
    },
    serverRoutes = [],
    secrets = [],
    completionProviders = [],
  }: {
    name: string
    nodes?: MagickComponentArray
    services?: any
    serverInit?: Function
    agentMethods?: {
      start: Function
      stop: Function
    }
    inputTypes?: any[]
    outputTypes?: any[]
    serverRoutes?: Array<PluginServerRoute>
    secrets?: PluginSecret[]
    completionProviders?: any[]
  }) {
    super({
      name,
      nodes,
      inputTypes,
      outputTypes,
      secrets,
      completionProviders
    })
    this.services = services
    this.agentMethods = agentMethods
    this.serverInit = serverInit
    this.serverRoutes = serverRoutes
    pluginManager.register(this)
  }
}

class PluginManager {
  pluginList: Array<ClientPlugin | ServerPlugin>
  componentList: Object
  plugins
  constructor() {
    this.pluginList = new Array<ClientPlugin | ServerPlugin>()
    this.componentList = {}
  }

  register(plugin: ClientPlugin | ServerPlugin) {
    this.pluginList.push(plugin)
  }

  getInputTypes() {
    const inputTypes = [] as any[]
    this.pluginList.forEach(plugin => {
      plugin.inputTypes.forEach(inputType => {
        inputTypes.push(inputType)
      })
    })
    return inputTypes
  }

  
  getOutputTypes() {
    const outputTypes = [] as any[]
    this.pluginList.forEach(plugin => {
      plugin.outputTypes.forEach(outputType => {
        outputTypes.push(outputType)
      })
    })
    return outputTypes
  }

  getNodes() {
    let nodes = {}

    this.pluginList.forEach(plugin => {
      let plug_nodes = {}
      plugin.nodes.forEach(node => {
        const id = Math.random().toString(36).slice(2, 7)
        const obj = {}
        obj[id] = () => new node()
        plug_nodes = { ...plug_nodes, ...obj }
      })
      nodes = { ...nodes, ...plug_nodes }
    })

    return nodes
  }

  getSecrets(global = false) {
    const secrets = [] as any[]
    this.pluginList.forEach(plugin => {
      plugin.secrets.forEach(secret => {
        if (global && !secret.global) return
        secrets.push(secret)
      })
    })
    return secrets
  }

  getCompletionProviders(type = null, subtypes: null | string[] = null): CompletionProvider[] {
    const completionProviders = [] as any[]
    this.pluginList.forEach(plugin => {
      plugin.completionProviders.forEach(provider => {
        if(type && provider.type !== type) return
        if(subtypes && !subtypes.includes(provider.subtype)) return
        completionProviders.push(provider)
      })
    })
    return completionProviders
  }
}

class ClientPluginManager extends PluginManager {
  declare pluginList: Array<ClientPlugin>
  constructor() {
    super()
    this.pluginList = new Array<ClientPlugin>()
  }

  getAgentComponents() {
    const agentComp = [] as any[]
    ;(this.pluginList as ClientPlugin[]).forEach((plugin: ClientPlugin) => {
      plugin.agentComponents.forEach(component => {
        agentComp.push(component)
      })
    })
    return agentComp
  }

  getClientRoutes() {
    const clientRoutes = [] as any[]
    ;(this.pluginList as ClientPlugin[]).forEach((plugin: ClientPlugin) => {
      if (plugin.clientRoutes) {
        plugin.clientRoutes.forEach(route => {
          clientRoutes.push({ ...route, plugin: plugin.name })
        })
      }
    })
    return clientRoutes
  }

  getGroupedClientRoutes() {
    let lastPluginRoute = ''
    const pluginRoutes = this.getClientRoutes()
    const pluginRoutesGrouped = pluginRoutes.reduce((acc, route) => {
      if (route.plugin !== lastPluginRoute) {
        acc.push({
          plugin: route.plugin,
          routes: [route],
        })
      } else {
        acc[acc.length - 1].routes.push(route)
      }
      lastPluginRoute = route.plugin
      return acc
    }, [])

    pluginRoutesGrouped.map(pluginRouteGroup => {
      const ClientPageLayout =
        pluginManager.getClientPageLayout(pluginRouteGroup.plugin) || null
      pluginRouteGroup.layout = ClientPageLayout
    })
    return pluginRoutesGrouped
  }

  getClientPageLayout(p) {
    const plugin = this.pluginList.filter(
      plugin => plugin.name === p
    )[0] as ClientPlugin

    return plugin.clientPageLayout
  }

  getDrawerItems() {
    const drawerItems = [] as any[]
    ;(this.pluginList as ClientPlugin[]).forEach((plugin: ClientPlugin) => {
      if (plugin.drawerItems) {
        plugin.drawerItems.forEach(drawerItem => {
          drawerItems.push({ ...drawerItem, plugin: plugin.name })
        })
      }
    })
    return drawerItems
  }

  getInputTypes() {
    const inputTypes = [] as any[]
    this.pluginList.forEach(plugin => {
      plugin.inputTypes.forEach(inputType => {
        inputTypes.push(inputType)
      })
    })
    return inputTypes
  }

  getInputByName(){
    const inputTypes = {}
    this.pluginList.forEach(plugin => {
      inputTypes[plugin.name] = plugin.inputTypes
    })
    return inputTypes
  }

  getPlugins(){
    const pluginList = {}
    this.pluginList.forEach(plugin => {
      pluginList[plugin.name] = 'NONE'
    })
    return pluginList
  }

  
}

class ServerPluginManager extends PluginManager {
  pluginList: Array<ServerPlugin>
  constructor() {
    super()
    this.pluginList = new Array<ServerPlugin>()
  }

  getAgentStartMethods() {
    let agentStartMethods = {}
    ;(this.pluginList as ServerPlugin[]).forEach((plugin: ServerPlugin) => {
      if (plugin.agentMethods) {
        const obj = {}
        obj[plugin.name] = plugin.agentMethods.start
        agentStartMethods = { ...agentStartMethods, ...obj }
      }
    })
    return agentStartMethods
  }

  getAgentStopMethods() {
    let agentStopMethods = {}
    ;(this.pluginList as ServerPlugin[]).forEach((plugin: ServerPlugin) => {
      if (plugin.agentMethods) {
        const obj = {}
        obj[plugin.name] = plugin.agentMethods.stop
        agentStopMethods = { ...agentStopMethods, ...obj }
      }
    })
    return agentStopMethods
  }

  getServices() {
    const serviceList = [] as any[]
    ;(this.pluginList as ServerPlugin[]).forEach((plugin: ServerPlugin) => {
      Object.keys(plugin.services).forEach(key => {
        serviceList.push([key, plugin.services[key]])
      })
    })
    return serviceList
  }

  getServerInits() {
    let serverInits = {}
    ;(this.pluginList as ServerPlugin[]).forEach((plugin: ServerPlugin) => {
      if (plugin.serverInit) {
        const obj = {}
        obj[plugin.name] = plugin.serverInit
        serverInits = { ...serverInits, ...obj }
      }
    })
    return serverInits
  }

  getServerRoutes() {
    const serverRoutes = [] as any[]
    ;(this.pluginList as ServerPlugin[]).forEach((plugin: ServerPlugin) => {
      if (plugin.serverRoutes) {
        plugin.serverRoutes.forEach(route => {
          serverRoutes.push(route)
        })
      }
    })
    return serverRoutes
  }
}

export const pluginManager =
  typeof window !== 'undefined'
    ? new ClientPluginManager()
    : (new ServerPluginManager() as any)
