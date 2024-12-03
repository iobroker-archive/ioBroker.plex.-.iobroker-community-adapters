const request = require('request-promise');
const { XMLParser } = require('fast-xml-parser');
const xml = new XMLParser();
const HEADERS = {
    'X-Plex-Client-Identifier': 'identifier',
    'X-Plex-Product': 'product',
    'X-Plex-Version': 'version',
    'X-Plex-Device': 'device',
    'X-Plex-Device-Name': 'deviceName',
    'X-Plex-Platform': 'platform',
    'X-Plex-Platform-Version': 'platformVersion',
};

/**
 * The constructor for PlexPinAuth.
 *
 * @param			options			Required headers
 * @param			options.
 * @returns
 */
const PlexPinAuth = function (options) {
    if (!(this instanceof PlexPinAuth)) {
        return new PlexPinAuth(options);
    }

    this.headers = this.getHeaders(options || {});
    this.tokens = {};
};

/**
 * This function converts the options to headers.
 *
 * @param void
 * @param options
 * @returns
 */
PlexPinAuth.prototype.getHeaders = function (options) {
    const headers = {};
    let val;

    for (const key in HEADERS) {
        val = options[HEADERS[key]] || false;
        if (val !== false) {
            headers[key] = val;
        }
    }

    headers['X-Plex-Provides'] = 'controller';
    return headers;
};

/**
 * This function requests a new pin.
 *
 * @param void
 * @returns
 */
PlexPinAuth.prototype.getPin = function () {
    return request
        .post({
            url: 'https://plex.tv/pins.xml',
            headers: this.headers,
        })
        .then(res => {
            const response = xml.parse(res);
            response.pin.token = null;
            response.pin.status = 'RETRIEVED_CODE';
            return response.pin;
        })
        .catch(err => {
            throw err;
        });
};

/**
 * This function retrieves the token based on a pin.
 *
 * @param		pin			PIN
 * @returns
 */
PlexPinAuth.prototype.getToken = function (pin) {
    // retrieve from cache
    if (this.tokens[pin]) {
        return Promise.resolve({
            token: true,
            status: 'RETRIEVED_TOKEN',
            auth_token: this.tokens[pin],
        });
    }

    // no cache, thus retrieve online
    return request
        .get({
            url: `https://plex.tv/pins/${pin}.xml`,
            headers: this.headers,
        })
        .then(res => {
            const response = xml.parse(res);
            response.pin.token = null;
            response.pin.status = 'RETRIEVING_TOKEN';

            // check for timeout
            if (new Date().toISOString() >= response.pin['expires-at']) {
                response.pin.token = false;
                response.pin.status = 'TIMEOUT_TOKEN';
            }

            // token retrieved
            if (response.pin['auth-token']) {
                response.pin.token = true;
                response.pin.status = 'RETRIEVED_TOKEN';
                this.tokens[pin] = response.pin['auth-token'];
            }

            return response.pin;
        })
        .catch(err => {
            throw err;
        });
};

module.exports = PlexPinAuth;
