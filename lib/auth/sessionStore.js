"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sessionData_1 = require("./sessionData");
// import { BLOCKSTACK_GAIA_HUB_LABEL } from '../storage/hub'
const authConstants_1 = require("./authConstants");
const errors_1 = require("../errors");
// import { Logger } from '../logger'
/**
 * An abstract class representing the SessionDataStore interface.
 * @type {SessionData}
 */
class SessionDataStore {
    constructor(sessionOptions) {
        if (sessionOptions) {
            const newSessionData = new sessionData_1.SessionData(sessionOptions);
            this.setSessionData(newSessionData);
        }
    }
    getSessionData() {
        throw new Error('Abstract class');
    }
    /* eslint-disable */
    setSessionData(session) {
        throw new Error('Abstract class');
    }
    deleteSessionData() {
        throw new Error('Abstract class');
    }
}
exports.SessionDataStore = SessionDataStore;
/**
 * Stores session data in the instance of this class.
 * @type {InstanceDataStore}
 */
class InstanceDataStore extends SessionDataStore {
    constructor(sessionOptions) {
        super(sessionOptions);
        if (!this.sessionData) {
            this.setSessionData(new sessionData_1.SessionData({}));
        }
    }
    getSessionData() {
        if (!this.sessionData) {
            throw new errors_1.NoSessionDataError('No session data was found.');
        }
        return this.sessionData;
    }
    setSessionData(session) {
        this.sessionData = session;
        return true;
    }
    deleteSessionData() {
        this.setSessionData(new sessionData_1.SessionData({}));
        return true;
    }
}
exports.InstanceDataStore = InstanceDataStore;
/**
 * Stores session data in browser a localStorage entry.
 * @type {LocalStorageStore}
 */
class LocalStorageStore extends SessionDataStore {
    constructor(sessionOptions) {
        super(sessionOptions);
        if (sessionOptions
            && sessionOptions.storeOptions
            && sessionOptions.storeOptions.localStorageKey
            && (typeof sessionOptions.storeOptions.localStorageKey === 'string')) {
            this.key = sessionOptions.storeOptions.localStorageKey;
        }
        else {
            this.key = authConstants_1.LOCALSTORAGE_SESSION_KEY;
        }
        const data = localStorage.getItem(this.key);
        if (!data) {
            const sessionData = new sessionData_1.SessionData({});
            this.setSessionData(sessionData);
        }
    }
    getSessionData() {
        const data = localStorage.getItem(this.key);
        if (!data) {
            throw new errors_1.NoSessionDataError('No session data was found in localStorage');
        }
        const dataJSON = JSON.parse(data);
        return sessionData_1.SessionData.fromJSON(dataJSON);
    }
    setSessionData(session) {
        localStorage.setItem(this.key, session.toString());
        return true;
    }
    deleteSessionData() {
        localStorage.removeItem(this.key);
        this.setSessionData(new sessionData_1.SessionData({}));
        return true;
    }
}
exports.LocalStorageStore = LocalStorageStore;
//# sourceMappingURL=sessionStore.js.map