/**
 * Constants shared across MyChrome components.
 */

/**
 * Deterministic Chrome extension ID generated from the manifest RSA key.
 * All unpacked installs using the repository's manifest.json share this ID.
 */
export const EXTENSION_ID = "aeofpcedejopeeebdjfkapcabkkflhej";

/**
 * Expected WebSocket origin header from the Chrome extension.
 */
export const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;
