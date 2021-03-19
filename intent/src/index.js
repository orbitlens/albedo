import {generateRandomToken} from './random-token-generator'
import intentInterface from './intent-interface'
import intentErrors from './intent-errors'
import {requestIntentConfirmation} from './intent-dispatcher'
import {forgetSession, getAllImplicitSessions, getImplicitSession} from './implicit-session-storage'
import {bindWebStellarLinkHandler} from './web+stellar-handler'

if (typeof window === 'object' && typeof window.fetch !== 'function') {
    throw new Error('Browser FetchAPI is not available. For legacy browsers support use polyfills such as whatwg-fetch.')
}

/**
 * Albedo API external interface implementation.
 */
function AlbedoIntent() {
}

AlbedoIntent.prototype = {
    frontendUrl: 'https://albedo.link',

    /**
     * Initiate external intent request.
     * @param {String} intent - Intent name.
     * @param {Object} [params] - Request parameters.
     * @returns {Promise<Object>}
     */
    request(intent, params) {
        return requestIntentConfirmation(Object.assign(params || {}, {intent}), this.frontendUrl)
    },

    /**
     * Requests temporary permissions to execute the specific intents without calling confirmation dialog.
     * @param {Object} params - Intent parameters.
     * @param {Array<String>} params.intents - Requested intents.
     * @returns {Promise<ImplicitFlowIntentResult>}
     */
    implicitFlow(params) {
        return this.request('implicit_flow', params)
    },

    /**
     * Request secure third-party application authentication.
     * @param {Object} params - Intent parameters.
     * @param {String} [params.token] - Verification token generated by the application (should be unique or random).
     * @returns {Promise<PublicKeyIntentResult>}
     */
    publicKey(params) {
        params = Object.assign({}, params)
        if (!params.token) {
            params.token = generateRandomToken()
        }
        return this.request('public_key', params)
    },

    /**
     * Request transaction signing, returns the signed transaction envelope.
     * @param {Object} params - Intent parameters.
     * @param {String} params.xdr - A Stellar transaction in XDR format encoded in base64.
     * @param {String} [params.pubkey] - Specific public key requested by the application.
     * @param {String} [params.network] - Stellar account network identifier or private network passphrase.
     * @param {Boolean} [params.submit] - If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.
     * @returns {Promise<TxIntentResult>}
     */
    tx(params) {
        //TODO: check if txXdr is a Transaction instance and serialize it
        return this.request('tx', params)
    },

    /**
     * Request an asset trustline creation.
     * @param {Object} params - Intent parameters.
     * @param {String} params.destination - Payment destination address.
     * @param {String} params.amount - Amount to pay.
     * @param {String} [params.asset_code] - [Optional] Asset code (if not set XLM is implied).
     * @param {String} [params.asset_issuer] - [Optional] Asset issuer (if not set XLM is implied).
     * @param {String} [params.memo] - [Optional] Memo to be included in the payment.
     * @param {('MEMO_TEXT' | 'MEMO_ID' | 'MEMO_HASH' | 'MEMO_RETURN')} [params.memo_type] - [Optional] Memo type to be included in the payment.
     * @param {String} [params.pubkey] - Specific public key requested by the application.
     * @param {String} [params.network] - Stellar account network identifier or private network passphrase.
     * @param {Boolean} [params.submit] - If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.
     * @returns {Promise<PayIntentResult>}
     */
    pay(params) {
        return this.request('pay', params)
    },

    /**
     * Request an asset trustline creation.
     * @param {Object} params - Intent parameters.
     * @param {String} params.asset_code - Asset code.
     * @param {String} params.asset_issuer - Asset account issuer.
     * @param {String} [params.limit] - [Optional] Trustline limit.
     * @param {String} [params.pubkey] - Specific public key requested by the application.
     * @param {String} [params.network] - Stellar account network identifier or private network passphrase.
     * @param {Boolean} [params.submit] - If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.
     * @returns {Promise<TrustIntentResult>}
     */
    trust(params) {
        return this.request('trust', params)
    },

    /**
     * Request token exchange on Stellar DEX.
     * @param {Object} params - Intent parameters.
     * @param {String} params.destination - Payment destination address.
     * @param {String} params.amount - Amount to pay.
     * @param {String} params.max_price - Maximum price to pay.
     * @param {String} [params.sell_asset_code] - [Optional] Selling asset code (if not set XLM is implied).
     * @param {String} [params.sell_asset_issuer] - [Optional] Selling asset issuer (if not set XLM is implied).
     * @param {String} [params.buy_asset_code] - [Optional] Selling asset code (if not set XLM is implied).
     * @param {String} [params.buy_asset_issuer] - [Optional] Selling asset issuer (if not set XLM is implied).
     * @return {Promise<ExchangeIntentResult>}
     */
    exchange(params) {
        return this.request('exchange', params)
    },

    /**
     * Request arbitrary data signing.
     * @param {Object} params - Intent parameters.
     * @param {String} params.message - Text message to sign.
     * @param {String} [params.pubkey] - Specific public key requested by the application.
     * @returns {Promise<SignMessageIntentResult>}
     */
    signMessage(params) {
        params = Object.assign({}, params, {message: normalizeMessageToSign(params.message)})
        return this.request('sign_message', params)
    },

    /**
     * Open account settings window for a given account.
     * @param {Object} params - Intent parameters.
     * @param {String} params.pubkey - Specific public key requested by the application.
     * @param {String} [params.network] - Stellar account network identifier or private network passphrase.
     * @returns {Promise<ManageAccountIntentResult>}
     */
    manageAccount(params) {
        return this.request('manage_account', params)
    },

    generateRandomToken() {
        return generateRandomToken()
    },

    /**
     * Check whether an implicit session exists for a given intent and pubkey.
     * @param {String} intent
     * @param {String} pubkey
     * @return {boolean}
     */
    isImplicitSessionAllowed(intent, pubkey) {
        return !!getImplicitSession(intent, pubkey)
    },

    /**
     * Enumerate all currently active implicit sessions.
     * @returns {Array<{pubkey: String, session: String, valid_until: Number, grants: Array<String>}>}
     */
    listImplicitSessions() {
        return getAllImplicitSessions()
    },

    /**
     * Revoke session permission granted for an account.
     * @param {String} pubkey
     */
    forgetImplicitSession(pubkey){
        forgetSession(pubkey)
    }
}

/**
 * Normalize a message before sending it to the signing endpoint.
 * @param {String} message - Message to normalize.
 * @returns {String}
 */
function normalizeMessageToSign(message) {
    switch (typeof message) {
        case 'string':
            return message
        case 'undefined':
            return ''
    }
    return JSON.stringify(message)
}

AlbedoIntent.intentInterface = intentInterface
AlbedoIntent.intentErrors = intentErrors

const albedo = new AlbedoIntent()

bindWebStellarLinkHandler(albedo)

export {intentInterface, intentErrors}
export default albedo