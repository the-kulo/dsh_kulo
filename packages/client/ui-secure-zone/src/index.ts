/**
 * Secure zone (安全区) plugin, node half. Pure UI plugin: the empty apply
 * exists so the plugin appears in the host cordis.yml / Loader; the browser
 * half ships via exports["./client"], discovered through the package.json
 * dsh.client declaration. The sidebar history is read-only; conversations
 * run under the shipped secure agent preset
 * (packages/bundle/web-app/presets/secure.patch.yml), which carries the
 * gateway's secure-zone semantics (local `LKL-GLM-5.2-FP8` only, no
 * external tools, no data leaving the deployment).
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
