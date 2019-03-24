"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const authConstants_1 = require("./authConstants");
/**
 * Configuration data for the current app.
 *
 * On browser platforms, creating an instance of this
 * class without any arguments will use
 * `window.location.origin` as the app domain.
 * On non-browser platforms, you need to
 * specify an app domain as the first argument.
 * @type {AppConfig}
 */
class AppConfig {
    /**
     * @param {Array<string>} scopes - permissions this app is requesting
     * @param {string} appDomain - the app domain
     * @param {string} redirectPath - path on app domain to redirect users to after authentication
     * @param {string} manifestPath - path relative to app domain of app's manifest file
     * @param {string} coreNode - override the default or user selected core node
     * @param {string} authenticatorURL - the web-based fall back authenticator
     */
    constructor(scopes = authConstants_1.DEFAULT_SCOPE.slice(), appDomain = window.location.origin, redirectPath = '', manifestPath = '/manifest.json', coreNode = null, authenticatorURL = authConstants_1.DEFAULT_BLOCKSTACK_HOST) {
        this.appDomain = appDomain;
        this.scopes = scopes;
        this.redirectPath = redirectPath;
        this.manifestPath = manifestPath;
        if (!coreNode) {
            this.coreNode = authConstants_1.DEFAULT_CORE_NODE;
        }
        else {
            this.coreNode = coreNode;
        }
        this.authenticatorURL = authenticatorURL;
    }
    /**
     * The location to which the authenticator should
     * redirect the user.
     * @returns {string} - URI
     */
    redirectURI() {
        return `${this.appDomain}${this.redirectPath}`;
    }
    /**
     * The location of the app's manifest file.
     * @returns {string} - URI
     */
    manifestURI() {
        return `${this.appDomain}${this.manifestPath}`;
    }
}
exports.AppConfig = AppConfig;
//# sourceMappingURL=appConfig.js.map