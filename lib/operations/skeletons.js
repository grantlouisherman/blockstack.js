"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bitcoinjs_lib_1 = __importDefault(require("bitcoinjs-lib"));
const bn_js_1 = __importDefault(require("bn.js"));
const utils_1 = require("./utils");
const config_1 = require("../config");
// todo : add name length / character verification
class BlockstackNamespace {
    constructor(namespaceID) {
        if (namespaceID.length > 19) {
            throw new Error('Namespace ID too long (19 chars max)');
        }
        if (!namespaceID.match('[0123456789abcdefghijklmnopqrstuvwxyz_-]+')) {
            throw new Error('Namespace ID can only use characters 0123456789abcdefghijklmnopqrstuvwxyz-_');
        }
        this.namespaceID = namespaceID;
        this.version = -1;
        this.lifetime = -1;
        this.coeff = -1;
        this.base = -1;
        this.buckets = [-1];
        this.nonalphaDiscount = -1;
        this.noVowelDiscount = -1;
    }
    check() {
        try {
            this.setVersion(this.version);
            this.setLifetime(this.lifetime);
            this.setCoeff(this.coeff);
            this.setBase(this.base);
            this.setBuckets(this.buckets);
            this.setNonalphaDiscount(this.nonalphaDiscount);
            this.setNoVowelDiscount(this.noVowelDiscount);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    setVersion(version) {
        if (version < 0 || version > Math.pow(2, 16) - 1) {
            throw new Error('Invalid version: must be a 16-bit number');
        }
        this.version = version;
    }
    setLifetime(lifetime) {
        if (lifetime < 0 || lifetime > Math.pow(2, 32) - 1) {
            throw new Error('Invalid lifetime: must be a 32-bit number');
        }
        this.lifetime = lifetime;
    }
    setCoeff(coeff) {
        if (coeff < 0 || coeff > 255) {
            throw new Error('Invalid coeff: must be an 8-bit number');
        }
        this.coeff = coeff;
    }
    setBase(base) {
        if (base < 0 || base > 255) {
            throw new Error('Invalid base: must be an 8-bit number');
        }
        this.base = base;
    }
    setBuckets(buckets) {
        if (buckets.length !== 16) {
            throw new Error('Invalid buckets: must have 16 entries');
        }
        for (let i = 0; i < buckets.length; i++) {
            if (buckets[i] < 0 || buckets[i] > 15) {
                throw new Error('Invalid buckets: must be 4-bit numbers');
            }
        }
        this.buckets = buckets.slice(0);
    }
    setNonalphaDiscount(nonalphaDiscount) {
        if (nonalphaDiscount <= 0 || nonalphaDiscount > 15) {
            throw new Error('Invalid nonalphaDiscount: must be a positive 4-bit number');
        }
        this.nonalphaDiscount = nonalphaDiscount;
    }
    setNoVowelDiscount(noVowelDiscount) {
        if (noVowelDiscount <= 0 || noVowelDiscount > 15) {
            throw new Error('Invalid noVowelDiscount: must be a positive 4-bit number');
        }
        this.noVowelDiscount = noVowelDiscount;
    }
    toHexPayload() {
        const lifeHex = `00000000${this.lifetime.toString(16)}`.slice(-8);
        const coeffHex = `00${this.coeff.toString(16)}`.slice(-2);
        const baseHex = `00${this.base.toString(16)}`.slice(-2);
        const bucketHex = this.buckets.map(b => b.toString(16)).reduce((b1, b2) => b1 + b2, '');
        const discountHex = this.nonalphaDiscount.toString(16) + this.noVowelDiscount.toString(16);
        const versionHex = `0000${this.version.toString(16)}`.slice(-4);
        const namespaceIDHex = Buffer.from(this.namespaceID).toString('hex');
        return lifeHex + coeffHex + baseHex + bucketHex + discountHex + versionHex + namespaceIDHex;
    }
}
exports.BlockstackNamespace = BlockstackNamespace;
function asAmountV2(amount) {
    // convert an AmountType v1 or v2 to an AmountTypeV2.
    // the "units" of a v1 amount type are always 'BTC'
    if (typeof amount === 'number') {
        return { units: 'BTC', amount: new bn_js_1.default(String(amount)) };
    }
    else {
        return { units: amount.units, amount: amount.amount };
    }
}
function makeTXbuilder() {
    const txb = new bitcoinjs_lib_1.default.TransactionBuilder(config_1.config.network.layer1);
    txb.setVersion(1);
    return txb;
}
function opEncode(opcode) {
    // NOTE: must *always* a 3-character string
    const res = `${config_1.config.network.MAGIC_BYTES}${opcode}`;
    if (res.length !== 3) {
        throw new Error('Runtime error: invalid MAGIC_BYTES');
    }
    return res;
}
function makePreorderSkeleton(fullyQualifiedName, consensusHash, preorderAddress, burnAddress, burn, registerAddress = null) {
    // Returns a preorder tx skeleton.
    //   with 3 outputs : 1. the Blockstack Preorder OP_RETURN data
    //                    2. the Preorder's change address (5500 satoshi minimum)
    //                    3. the BURN
    //
    // 0     2  3                                     23             39          47            66
    // |-----|--|--------------------------------------|--------------|-----------|-------------|
    // magic op  hash160(fqn,scriptPubkey,registerAddr) consensus hash token burn  token type
    //                                                                 (optional)   (optional)
    //
    // output 0: name preorder code
    // output 1: preorder address
    // output 2: burn address
    //
    // Returns an unsigned serialized transaction.
    const burnAmount = asAmountV2(burn);
    const network = config_1.config.network;
    const nameBuff = Buffer.from(utils_1.decodeB40(fullyQualifiedName), 'hex'); // base40
    const scriptPublicKey = bitcoinjs_lib_1.default.address.toOutputScript(preorderAddress, network.layer1);
    const dataBuffers = [nameBuff, scriptPublicKey];
    if (!!registerAddress) {
        const registerBuff = Buffer.from(registerAddress, 'ascii');
        dataBuffers.push(registerBuff);
    }
    const dataBuff = Buffer.concat(dataBuffers);
    const hashed = utils_1.hash160(dataBuff);
    const opReturnBufferLen = burnAmount.units === 'BTC' ? 39 : 66;
    const opReturnBuffer = Buffer.alloc(opReturnBufferLen);
    opReturnBuffer.write(opEncode('?'), 0, 3, 'ascii');
    hashed.copy(opReturnBuffer, 3);
    opReturnBuffer.write(consensusHash, 23, 16, 'hex');
    if (burnAmount.units !== 'BTC') {
        const burnHex = burnAmount.amount.toString(16, 2);
        if (burnHex.length > 16) {
            // exceeds 2**64; can't fit
            throw new Error(`Cannot preorder '${fullyQualifiedName}': cannot fit price into 8 bytes`);
        }
        const paddedBurnHex = `0000000000000000${burnHex}`.slice(-16);
        opReturnBuffer.write(paddedBurnHex, 39, 8, 'hex');
        opReturnBuffer.write(burnAmount.units, 47, burnAmount.units.length, 'ascii');
    }
    const nullOutput = bitcoinjs_lib_1.default.payments.embed({ data: [opReturnBuffer] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(nullOutput, 0);
    tx.addOutput(preorderAddress, utils_1.DUST_MINIMUM);
    if (burnAmount.units === 'BTC') {
        const btcBurnAmount = burnAmount.amount.toNumber();
        tx.addOutput(burnAddress, btcBurnAmount);
    }
    else {
        tx.addOutput(burnAddress, utils_1.DUST_MINIMUM);
    }
    return tx.buildIncomplete();
}
exports.makePreorderSkeleton = makePreorderSkeleton;
function makeRegisterSkeleton(fullyQualifiedName, ownerAddress, valueHash = null, burnTokenAmountHex = null) {
    // Returns a register tx skeleton.
    //   with 2 outputs : 1. The register OP_RETURN
    //                    2. The owner address (can be different from REGISTER address on renewals)
    // You MUST make the first input a UTXO from the current OWNER *or* the
    //   funder of the PREORDER
    // in the case of a renewal, this would need to be modified to include a change address
    //  as output (3) before the burn output (4)
    /*
      Formats
  
      No zonefile hash, and pay with BTC:
  
      0    2  3                                  39
      |----|--|----------------------------------|
      magic op   name.ns_id (up to 37 bytes)
  
  
      With zonefile hash, and pay with BTC:
  
      0    2  3                                  39                  59
      |----|--|----------------------------------|-------------------|
      magic op   name.ns_id (37 bytes, 0-padded)     zone file hash
  
      output 0: name registration code
      output 1: owner address
    */
    let payload;
    if (!!burnTokenAmountHex && !valueHash) {
        // empty value hash
        valueHash = '0000000000000000000000000000000000000000';
    }
    if (!!valueHash) {
        if (valueHash.length !== 40) {
            throw new Error('Value hash length incorrect. Expecting 20-bytes, hex-encoded');
        }
        if (!!burnTokenAmountHex) {
            if (burnTokenAmountHex.length !== 16) {
                throw new Error('Burn field length incorrect.  Expecting 8-bytes, hex-encoded');
            }
        }
        const payloadLen = burnTokenAmountHex ? 65 : 57;
        payload = Buffer.alloc(payloadLen, 0);
        payload.write(fullyQualifiedName, 0, 37, 'ascii');
        payload.write(valueHash, 37, 20, 'hex');
        if (!!burnTokenAmountHex) {
            payload.write(burnTokenAmountHex, 57, 8, 'hex');
        }
    }
    else {
        payload = Buffer.from(fullyQualifiedName, 'ascii');
    }
    const opReturnBuffer = Buffer.concat([Buffer.from(opEncode(':'), 'ascii'), payload]);
    const nullOutput = bitcoinjs_lib_1.default.payments.embed({ data: [opReturnBuffer] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(nullOutput, 0);
    tx.addOutput(ownerAddress, utils_1.DUST_MINIMUM);
    return tx.buildIncomplete();
}
exports.makeRegisterSkeleton = makeRegisterSkeleton;
function makeRenewalSkeleton(fullyQualifiedName, nextOwnerAddress, lastOwnerAddress, burnAddress, burn, valueHash = null) {
    /*
      Formats
  
      No zonefile hash, and pay with BTC:
  
      0    2  3                                  39
      |----|--|----------------------------------|
      magic op   name.ns_id (up to 37 bytes)
  
  
      With zonefile hash, and pay with BTC:
  
      0    2  3                                  39                  59
      |----|--|----------------------------------|-------------------|
      magic op   name.ns_id (37 bytes, 0-padded)     zone file hash
  
  
     With renewal payment in a token:
     (for register, tokens burned is not included)
     (for renew, tokens burned is the number of tokens to burn)
  
     0    2  3                                  39                  59                            67
     |----|--|----------------------------------|-------------------|------------------------------|
     magic op   name.ns_id (37 bytes, 0-padded)     zone file hash    tokens burned (big-endian)
  
     output 0: renewal code
     output 1: new owner address
     output 2: current owner address
     output 3: burn address
    */
    const burnAmount = asAmountV2(burn);
    const network = config_1.config.network;
    const burnTokenAmount = burnAmount.units === 'BTC' ? null : burnAmount.amount;
    const burnBTCAmount = burnAmount.units === 'BTC'
        ? burnAmount.amount.toNumber() : utils_1.DUST_MINIMUM;
    let burnTokenHex = null;
    if (!!burnTokenAmount) {
        const burnHex = burnTokenAmount.toString(16, 2);
        if (burnHex.length > 16) {
            // exceeds 2**64; can't fit 
            throw new Error(`Cannot renew '${fullyQualifiedName}': cannot fit price into 8 bytes`);
        }
        burnTokenHex = `0000000000000000${burnHex}`.slice(-16);
    }
    const registerTX = makeRegisterSkeleton(fullyQualifiedName, nextOwnerAddress, valueHash, burnTokenHex);
    const txB = bitcoinjs_lib_1.default.TransactionBuilder.fromTransaction(registerTX, network.layer1);
    txB.addOutput(lastOwnerAddress, utils_1.DUST_MINIMUM);
    txB.addOutput(burnAddress, burnBTCAmount);
    return txB.buildIncomplete();
}
exports.makeRenewalSkeleton = makeRenewalSkeleton;
function makeTransferSkeleton(fullyQualifiedName, consensusHash, newOwner, keepZonefile = false) {
    // Returns a transfer tx skeleton.
    //   with 2 outputs : 1. the Blockstack Transfer OP_RETURN data
    //                    2. the new owner with a DUST_MINIMUM value (5500 satoshi)
    //
    // You MUST make the first input a UTXO from the current OWNER
    //
    // Returns an unsigned serialized transaction.
    /*
      Format
  
      0     2  3    4                   20              36
      |-----|--|----|-------------------|---------------|
      magic op keep  hash128(name.ns_id) consensus hash
               data?
  
      output 0: transfer code
      output 1: new owner
    */
    const opRet = Buffer.alloc(36);
    let keepChar = '~';
    if (keepZonefile) {
        keepChar = '>';
    }
    opRet.write(opEncode('>'), 0, 3, 'ascii');
    opRet.write(keepChar, 3, 1, 'ascii');
    const hashed = utils_1.hash128(Buffer.from(fullyQualifiedName, 'ascii'));
    hashed.copy(opRet, 4);
    opRet.write(consensusHash, 20, 16, 'hex');
    const opRetPayload = bitcoinjs_lib_1.default.payments.embed({ data: [opRet] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(opRetPayload, 0);
    tx.addOutput(newOwner, utils_1.DUST_MINIMUM);
    return tx.buildIncomplete();
}
exports.makeTransferSkeleton = makeTransferSkeleton;
function makeUpdateSkeleton(fullyQualifiedName, consensusHash, valueHash) {
    // Returns an update tx skeleton.
    //   with 1 output : 1. the Blockstack update OP_RETURN
    //
    // You MUST make the first input a UTXO from the current OWNER
    //
    // Returns an unsigned serialized transaction.
    //
    // output 0: the revoke code
    /*
      Format:
  
      0     2  3                                   19                      39
      |-----|--|-----------------------------------|-----------------------|
      magic op  hash128(name.ns_id,consensus hash) hash160(data)
  
      output 0: update code
    */
    const opRet = Buffer.alloc(39);
    const nameBuff = Buffer.from(fullyQualifiedName, 'ascii');
    const consensusBuff = Buffer.from(consensusHash, 'ascii');
    const hashedName = utils_1.hash128(Buffer.concat([nameBuff, consensusBuff]));
    opRet.write(opEncode('+'), 0, 3, 'ascii');
    hashedName.copy(opRet, 3);
    opRet.write(valueHash, 19, 20, 'hex');
    const opRetPayload = bitcoinjs_lib_1.default.payments.embed({ data: [opRet] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(opRetPayload, 0);
    return tx.buildIncomplete();
}
exports.makeUpdateSkeleton = makeUpdateSkeleton;
function makeRevokeSkeleton(fullyQualifiedName) {
    // Returns a revoke tx skeleton
    //    with 1 output: 1. the Blockstack revoke OP_RETURN
    //
    // You MUST make the first input a UTXO from the current OWNER
    //
    // Returns an unsigned serialized transaction
    /*
     Format:
  
     0    2  3                             39
     |----|--|-----------------------------|
     magic op   name.ns_id (37 bytes)
  
     output 0: the revoke code
    */
    const opRet = Buffer.alloc(3);
    const nameBuff = Buffer.from(fullyQualifiedName, 'ascii');
    opRet.write(opEncode('~'), 0, 3, 'ascii');
    const opReturnBuffer = Buffer.concat([opRet, nameBuff]);
    const nullOutput = bitcoinjs_lib_1.default.payments.embed({ data: [opReturnBuffer] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(nullOutput, 0);
    return tx.buildIncomplete();
}
exports.makeRevokeSkeleton = makeRevokeSkeleton;
function makeNamespacePreorderSkeleton(namespaceID, consensusHash, preorderAddress, registerAddress, burn) {
    // Returns a namespace preorder tx skeleton.
    // Returns an unsigned serialized transaction.
    /*
     Formats:
  
     Without STACKS:
  
     0     2   3                                      23               39
     |-----|---|--------------------------------------|----------------|
     magic op  hash(ns_id,script_pubkey,reveal_addr)   consensus hash
  
  
     with STACKs:
  
     0     2   3                                      23               39                         47
     |-----|---|--------------------------------------|----------------|--------------------------|
     magic op  hash(ns_id,script_pubkey,reveal_addr)   consensus hash    token fee (big-endian)
  
     output 0: namespace preorder code
     output 1: change address
     otuput 2: burn address
    */
    const burnAmount = asAmountV2(burn);
    if (burnAmount.units !== 'BTC' && burnAmount.units !== 'STACKS') {
        throw new Error(`Invalid burnUnits ${burnAmount.units}`);
    }
    const network = config_1.config.network;
    const burnAddress = network.getDefaultBurnAddress();
    const namespaceIDBuff = Buffer.from(utils_1.decodeB40(namespaceID), 'hex'); // base40
    const scriptPublicKey = bitcoinjs_lib_1.default.address.toOutputScript(preorderAddress, network.layer1);
    const registerBuff = Buffer.from(registerAddress, 'ascii');
    const dataBuffers = [namespaceIDBuff, scriptPublicKey, registerBuff];
    const dataBuff = Buffer.concat(dataBuffers);
    const hashed = utils_1.hash160(dataBuff);
    let btcBurnAmount = utils_1.DUST_MINIMUM;
    let opReturnBufferLen = 39;
    if (burnAmount.units === 'STACKS') {
        opReturnBufferLen = 47;
    }
    else {
        btcBurnAmount = burnAmount.amount.toNumber();
    }
    const opReturnBuffer = Buffer.alloc(opReturnBufferLen);
    opReturnBuffer.write(opEncode('*'), 0, 3, 'ascii');
    hashed.copy(opReturnBuffer, 3);
    opReturnBuffer.write(consensusHash, 23, 16, 'hex');
    if (burnAmount.units === 'STACKS') {
        const burnHex = burnAmount.amount.toString(16, 2);
        const paddedBurnHex = `0000000000000000${burnHex}`.slice(-16);
        opReturnBuffer.write(paddedBurnHex, 39, 8, 'hex');
    }
    const nullOutput = bitcoinjs_lib_1.default.payments.embed({ data: [opReturnBuffer] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(nullOutput, 0);
    tx.addOutput(preorderAddress, utils_1.DUST_MINIMUM);
    tx.addOutput(burnAddress, btcBurnAmount);
    return tx.buildIncomplete();
}
exports.makeNamespacePreorderSkeleton = makeNamespacePreorderSkeleton;
function makeNamespaceRevealSkeleton(namespace, revealAddress) {
    /*
     Format:
  
     0     2   3    7     8     9    10   11   12   13   14    15    16    17       18      20     39
     |-----|---|----|-----|-----|----|----|----|----|----|-----|-----|-----|--------|-------|-------|
     magic  op  life coeff. base 1-2  3-4  5-6  7-8  9-10 11-12 13-14 15-16 nonalpha version  ns ID
                                                    bucket exponents        no-vowel
                                                                            discounts
     
     output 0: namespace reveal code
     output 1: reveal address
    */
    const hexPayload = namespace.toHexPayload();
    const opReturnBuffer = Buffer.alloc(3 + hexPayload.length / 2);
    opReturnBuffer.write(opEncode('&'), 0, 3, 'ascii');
    opReturnBuffer.write(hexPayload, 3, hexPayload.length / 2, 'hex');
    const nullOutput = bitcoinjs_lib_1.default.payments.embed({ data: [opReturnBuffer] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(nullOutput, 0);
    tx.addOutput(revealAddress, utils_1.DUST_MINIMUM);
    return tx.buildIncomplete();
}
exports.makeNamespaceRevealSkeleton = makeNamespaceRevealSkeleton;
function makeNamespaceReadySkeleton(namespaceID) {
    /*
     Format:
  
     0     2  3  4           23
     |-----|--|--|------------|
     magic op  .  ns_id
  
     output 0: namespace ready code
     */
    const opReturnBuffer = Buffer.alloc(3 + namespaceID.length + 1);
    opReturnBuffer.write(opEncode('!'), 0, 3, 'ascii');
    opReturnBuffer.write(`.${namespaceID}`, 3, namespaceID.length + 1, 'ascii');
    const nullOutput = bitcoinjs_lib_1.default.payments.embed({ data: [opReturnBuffer] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(nullOutput, 0);
    return tx.buildIncomplete();
}
exports.makeNamespaceReadySkeleton = makeNamespaceReadySkeleton;
// type bitcoin.payments.p2data bitcoin.payments.embed
function makeNameImportSkeleton(name, recipientAddr, zonefileHash) {
    /*
     Format:
  
      0    2  3                             39
      |----|--|-----------------------------|
      magic op   name.ns_id (37 bytes)
  
     Output 0: the OP_RETURN
     Output 1: the recipient
     Output 2: the zonefile hash
   */
    if (zonefileHash.length !== 40) {
        throw new Error('Invalid zonefile hash: must be 20 bytes hex-encoded');
    }
    const network = config_1.config.network;
    const opReturnBuffer = Buffer.alloc(3 + name.length);
    opReturnBuffer.write(opEncode(';'), 0, 3, 'ascii');
    opReturnBuffer.write(name, 3, name.length, 'ascii');
    const nullOutput = bitcoinjs_lib_1.default.payments.embed({ data: [opReturnBuffer] }).output;
    const tx = makeTXbuilder();
    const zonefileHashB58 = bitcoinjs_lib_1.default.address.toBase58Check(Buffer.from(zonefileHash, 'hex'), network.layer1.pubKeyHash);
    tx.addOutput(nullOutput, 0);
    tx.addOutput(recipientAddr, utils_1.DUST_MINIMUM);
    tx.addOutput(zonefileHashB58, utils_1.DUST_MINIMUM);
    return tx.buildIncomplete();
}
exports.makeNameImportSkeleton = makeNameImportSkeleton;
function makeAnnounceSkeleton(messageHash) {
    /*
      Format:
  
      0    2  3                             23
      |----|--|-----------------------------|
      magic op   message hash (160-bit)
  
      output 0: the OP_RETURN
    */
    if (messageHash.length !== 40) {
        throw new Error('Invalid message hash: must be 20 bytes hex-encoded');
    }
    const opReturnBuffer = Buffer.alloc(3 + messageHash.length / 2);
    opReturnBuffer.write(opEncode('#'), 0, 3, 'ascii');
    opReturnBuffer.write(messageHash, 3, messageHash.length / 2, 'hex');
    const nullOutput = bitcoinjs_lib_1.default.payments.embed({ data: [opReturnBuffer] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(nullOutput, 0);
    return tx.buildIncomplete();
}
exports.makeAnnounceSkeleton = makeAnnounceSkeleton;
function makeTokenTransferSkeleton(recipientAddress, consensusHash, tokenType, tokenAmount, scratchArea) {
    /*
     Format:
  
      0     2  3              19         38          46                        80
      |-----|--|--------------|----------|-----------|-------------------------|
      magic op  consensus_hash token_type amount (BE) scratch area
                               (ns_id)
  
      output 0: token transfer code
      output 1: recipient address
    */
    if (scratchArea.length > 34) {
        throw new Error('Invalid scratch area: must be no more than 34 bytes');
    }
    const opReturnBuffer = Buffer.alloc(46 + scratchArea.length);
    const tokenTypeHex = Buffer.from(tokenType).toString('hex');
    const tokenTypeHexPadded = `00000000000000000000000000000000000000${tokenTypeHex}`.slice(-38);
    const tokenValueHex = tokenAmount.toString(16, 2);
    if (tokenValueHex.length > 16) {
        // exceeds 2**64; can't fit
        throw new Error(`Cannot send tokens: cannot fit ${tokenAmount.toString()} into 8 bytes`);
    }
    const tokenValueHexPadded = `0000000000000000${tokenValueHex}`.slice(-16);
    opReturnBuffer.write(opEncode('$'), 0, 3, 'ascii');
    opReturnBuffer.write(consensusHash, 3, consensusHash.length / 2, 'hex');
    opReturnBuffer.write(tokenTypeHexPadded, 19, tokenTypeHexPadded.length / 2, 'hex');
    opReturnBuffer.write(tokenValueHexPadded, 38, tokenValueHexPadded.length / 2, 'hex');
    opReturnBuffer.write(scratchArea, 46, scratchArea.length, 'ascii');
    const nullOutput = bitcoinjs_lib_1.default.payments.embed({ data: [opReturnBuffer] }).output;
    const tx = makeTXbuilder();
    tx.addOutput(nullOutput, 0);
    tx.addOutput(recipientAddress, utils_1.DUST_MINIMUM);
    return tx.buildIncomplete();
}
exports.makeTokenTransferSkeleton = makeTokenTransferSkeleton;
//# sourceMappingURL=skeletons.js.map