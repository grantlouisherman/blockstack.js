"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
// @ts-ignore: Could not find a declaration file for module
const jsontokens_1 = require("jsontokens");
const utils_1 = require("../utils");
/**
  * Signs a profile token
  * @param {Object} profile - the JSON of the profile to be signed
  * @param {String} privateKey - the signing private key
  * @param {Object} subject - the entity that the information is about
  * @param {Object} issuer - the entity that is issuing the token
  * @param {String} signingAlgorithm - the signing algorithm to use
  * @param {Date} issuedAt - the time of issuance of the token
  * @param {Date} expiresAt - the time of expiration of the token
  * @returns {Object} - the signed profile token
  */
function signProfileToken(profile, privateKey, subject, issuer, signingAlgorithm = 'ES256K', issuedAt = new Date(), expiresAt = utils_1.nextYear()) {
    if (signingAlgorithm !== 'ES256K') {
        throw new Error('Signing algorithm not supported');
    }
    const publicKey = jsontokens_1.SECP256K1Client.derivePublicKey(privateKey);
    if (!subject) {
        subject = { publicKey };
    }
    if (!issuer) {
        issuer = { publicKey };
    }
    const tokenSigner = new jsontokens_1.TokenSigner(signingAlgorithm, privateKey);
    const payload = {
        jti: utils_1.makeUUID4(),
        iat: issuedAt.toISOString(),
        exp: expiresAt.toISOString(),
        subject,
        issuer,
        claim: profile
    };
    return tokenSigner.sign(payload);
}
exports.signProfileToken = signProfileToken;
/**
  * Wraps a token for a profile token file
  * @param {String} token - the token to be wrapped
  * @returns {Object} - including `token` and `decodedToken`
  */
function wrapProfileToken(token) {
    return {
        token,
        decodedToken: jsontokens_1.decodeToken(token)
    };
}
exports.wrapProfileToken = wrapProfileToken;
/**
  * Verifies a profile token
  * @param {String} token - the token to be verified
  * @param {String} publicKeyOrAddress - the public key or address of the
  *   keypair that is thought to have signed the token
  * @returns {Object} - the verified, decoded profile token
  * @throws {Error} - throws an error if token verification fails
  */
function verifyProfileToken(token, publicKeyOrAddress) {
    const decodedToken = jsontokens_1.decodeToken(token);
    const payload = decodedToken.payload;
    // Inspect and verify the subject
    if (payload.hasOwnProperty('subject')) {
        if (!payload.subject.hasOwnProperty('publicKey')) {
            throw new Error('Token doesn\'t have a subject public key');
        }
    }
    else {
        throw new Error('Token doesn\'t have a subject');
    }
    // Inspect and verify the issuer
    if (payload.hasOwnProperty('issuer')) {
        if (!payload.issuer.hasOwnProperty('publicKey')) {
            throw new Error('Token doesn\'t have an issuer public key');
        }
    }
    else {
        throw new Error('Token doesn\'t have an issuer');
    }
    // Inspect and verify the claim
    if (!payload.hasOwnProperty('claim')) {
        throw new Error('Token doesn\'t have a claim');
    }
    const issuerPublicKey = payload.issuer.publicKey;
    const publicKeyBuffer = Buffer.from(issuerPublicKey, 'hex');
    const compressedKeyPair = bitcoinjs_lib_1.ECPair.fromPublicKey(publicKeyBuffer, { compressed: true });
    const compressedAddress = utils_1.ecPairToAddress(compressedKeyPair);
    const uncompressedKeyPair = bitcoinjs_lib_1.ECPair.fromPublicKey(publicKeyBuffer, { compressed: false });
    const uncompressedAddress = utils_1.ecPairToAddress(uncompressedKeyPair);
    if (publicKeyOrAddress === issuerPublicKey) {
        // pass
    }
    else if (publicKeyOrAddress === compressedAddress) {
        // pass
    }
    else if (publicKeyOrAddress === uncompressedAddress) {
        // pass
    }
    else {
        throw new Error('Token issuer public key does not match the verifying value');
    }
    const tokenVerifier = new jsontokens_1.TokenVerifier(decodedToken.header.alg, issuerPublicKey);
    if (!tokenVerifier) {
        throw new Error('Invalid token verifier');
    }
    const tokenVerified = tokenVerifier.verify(token);
    if (!tokenVerified) {
        throw new Error('Token verification failed');
    }
    return decodedToken;
}
exports.verifyProfileToken = verifyProfileToken;
/**
  * Extracts a profile from an encoded token and optionally verifies it,
  * if `publicKeyOrAddress` is provided.
  * @param {String} token - the token to be extracted
  * @param {String} publicKeyOrAddress - the public key or address of the
  *   keypair that is thought to have signed the token
  * @returns {Object} - the profile extracted from the encoded token
  * @throws {Error} - if the token isn't signed by the provided `publicKeyOrAddress`
  */
function extractProfile(token, publicKeyOrAddress = null) {
    let decodedToken;
    if (publicKeyOrAddress) {
        decodedToken = verifyProfileToken(token, publicKeyOrAddress);
    }
    else {
        decodedToken = jsontokens_1.decodeToken(token);
    }
    let profile = {};
    if (decodedToken.hasOwnProperty('payload')) {
        const payload = decodedToken.payload;
        if (payload.hasOwnProperty('claim')) {
            profile = decodedToken.payload.claim;
        }
    }
    return profile;
}
exports.extractProfile = extractProfile;
//# sourceMappingURL=profileTokens.js.map