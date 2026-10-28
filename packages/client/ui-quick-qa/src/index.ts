/**
 * Quick answers (轻问答) plugin, node half. Pure UI plugin: the empty apply
 * exists so the plugin appears in the host cordis.yml / Loader; the browser
 * half ships via exports["./client"], discovered through the package.json
 * dsh.client declaration. The sidebar history is read-only; questions are
 * asked from the ordinary new-task composer with the shipped quick-qa agent
 * preset (packages/bundle/web-app/presets/quick-qa.patch.yml), which is
 * publicly selectable there.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
