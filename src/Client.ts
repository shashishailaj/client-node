import { Provider } from './providers/Provider';
const pkg = require('../package.json'); // tslint:disable-line no-var-requires no-require-imports
import { defaultsDeep } from 'lodash';
import { RequestResponse } from 'request';

import {
    DefaultRequestRunner,
    IOptionalUrlRequestOptions,
    IRequestOptions,
    IRequestRunner,
} from './RequestRunner';

import * as querystring from 'querystring';

export interface IRequestResponse<T> extends RequestResponse {
    body: T;
}

export class Client {
    private provider: Provider;
    private userAgent: string;
    public urls = {
        api: 'https://beam.pro/api/v1',
        public: 'https://beam.pro',
    };
    /**
     * The primary Beam client, responsible for storing authentication state
     * and dispatching requests to the API.
     */
    constructor (private requestRunner: IRequestRunner = new DefaultRequestRunner()) {
        this.userAgent = this.buildUserAgent();
    }

    private buildUserAgent () {
        const client = 'BeamClient/' + pkg.version;

        if (typeof navigator !== 'undefined') { // in-browser
            return navigator.userAgent + ' ' + client;
        }

        return client + ' (JavaScript; Node.js ' + process.version + ')';
    }

    /**
     * Sets the the API/public URLs for the client.
     */
    public setUrl (kind: 'api' | 'public',  url: string): this {
        (<{ [prop: string]: string }>this.urls)[kind] = url;
        return this;
    };

    /**
     * Builds a path to the Beam API by concating it with the address.
     */
    public buildAddress (base: string, path: string, querystr?: (string | Object)): string {
        let url = base;

        // Strip any trailing slash from the base
        if (url.slice(-1) === '/') {
            url = url.slice(0, -1);
        }
        // And any leading slash from the path.
        if (path.charAt(0) === '/') {
            path = path.slice(1);
        }

        url = url + '/' + path;

        // And just add the query string
        if (querystr) {
            url += '?' + querystring.stringify(querystr);
        }

        return url;
    }

    /**
     * Creates and returns an authentication provider instance.
     */
    public use (provider: Provider): this {
        this.provider = provider;
        return this;
    }

    /**
     * Returns the associated provider instance, as set by the
     * `use` method.
     */
    public getProvider (): Provider {
        return this.provider;
    }

    /**
     * Attempts to run a given request.
     */
    public request<T>(method: string, path: string, data?: IOptionalUrlRequestOptions): Promise<IRequestResponse<T>> {
        const req = defaultsDeep<IOptionalUrlRequestOptions, IRequestOptions>(
            data,
            {
                method: method,
                url: this.buildAddress(this.urls.api, path),
                headers: {
                    'User-Agent': this.userAgent,
                },
                json: true,
            },
            this.provider && this.provider.getRequest()
        );

        return this.requestRunner.run(req)
        .catch(err => {
            if (this.provider) {
                return this.provider.handleResponseError(err, req);
            }
            throw err;
        });
    };
}
