/** Backward-compatible public entrypoint for the plugin composition layer. */
export { seoAnalyzerPlugin, seoPlugin } from './plugin/createSeoPlugin.js'
export type { GenerateFnArgs, SeoPluginConfig } from './plugin/createSeoPlugin.js'
