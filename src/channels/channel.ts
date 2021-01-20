import {PresenceChannel} from './presence-channel';
import {PrivateChannel} from './private-channel';
import {Log} from './../log';

var crypto = require('crypto');
import {RedisDatabase} from '../database/redis';
import {Database} from "../database";

export class Channel {
    /**
     * Database instance.
     */
    db: Database;

    /**
     * Client App Id
     */
    appId: string;


    /**
     * Channels and patters for private channels.
     */
    protected _privateChannels: string[] = ['private-*', 'presence-*'];

    /**
     * Allowed client events
     */
    protected _clientEvents: string[] = ['client-*'];

    /**
     * Private channel instance.
     */
    private: PrivateChannel;

    /**
     * Presence channel instance.
     */
    presence: PresenceChannel;

    /**
     * Create a new channel instance.
     */
    constructor(private io, private options) {
        this.db = new Database(options);

        this.private = new PrivateChannel(options);
        this.presence = new PresenceChannel(io, options);

        if (this.options.devMode) {
            Log.success('Channels are ready.');
        }
    }


    /**
     * Join a channel.
     */
    join(socket, data): void {
        this.appId = data.app_id;


        this.db.get(this.appId).then(client_concurrent_connections => {

            //  Log.info('client_concurrent_connections=' + client_concurrent_connections);
            if (client_concurrent_connections > 2) {
                /* Log.error('Concurrent connections exceeded');
                 this.io.sockets.to(socket.id)
                     .emit('subscription_error', data.channel, 'the number of concurrent connections exceeded within the current subscription plan!');
                 return;*/
            }

            if (!this.isPrivate(data.channel)) {
                Log.success('Socket is opened! for a public channel (' + data.channel + ')');
                socket.join(data.channel);
                this.onJoin(socket, data.channel);
            } else
                this.joinPrivate(socket, data);

        });
    }

    /**
     * Trigger a client message
     */
    clientEvent(socket, data): void {
        try {
            data = JSON.parse(data);
        } catch (e) {
            data = data;
        }

        if (data.event && data.channel) {
            if (this.isClientEvent(data.event) &&
                this.isPrivate(data.channel) &&
                this.isInChannel(socket, data.channel)) {
                this.io.sockets.connected[socket.id]
                    .broadcast.to(data.channel)
                    .emit(data.event, data.channel, data.data);
            }
        }
    }

    /**
     * Leave a channel.
     */
    leave(socket: any, channel: string, reason: string): void {
        //Decrement the connection concurrent count of the given client
        //   this.db.decr(this.appKey);

        if (channel) {
            if (this.isPresence(channel)) {
                this.presence.leave(socket, channel)
            }

            socket.leave(channel);

            if (this.options.devMode) {
                Log.info(`[${new Date().toISOString()}] - ${socket.id} left channel: ${channel} (${reason})`);
            }
        }
    }

    /**
     * Check if the incoming socket connection is a private channel.
     */
    isPrivate(channel: string): boolean {
        let isPrivate = false;

        this._privateChannels.forEach(privateChannel => {
            let regex = new RegExp(privateChannel.replace('\*', '.*'));
            if (regex.test(channel)) isPrivate = true;
        });

        return isPrivate;
    }

    /**
     * Join private channel, emit data to presence channels.
     */
    joinPrivate(socket: any, data: any): void {
        //Private channel verification
        let socket_id = data.auth.socket_id;
        let signature = data.auth.extra.auth;

        const info = signature.split(':');
        let app_id = info[0];
        let received_hash = info [1];


        this.getClientSecret(app_id).then(client => {
            console.log('receved sec ', client.app_secret);
            let secret_key = client.app_secret;
            if (secret_key == null) {
                Log.error('Invalid client identification');
                this.io.sockets.to(socket.id)
                    .emit('subscription_error', data.channel, 'Invalid client identification!');
                return;
            }

            //trying to verify the given signature
            let client_hash = this.getSocketHash(socket_id, data.channel, secret_key);


            if (client_hash == received_hash) {
                Log.success('Valid signature!');
                Log.success('Socket is opened! for a private channel (' + data.channel + ')');
                socket.join(data.channel);
                this.onJoin(socket, data.channel);
            }
            else {
                Log.error('Invalid signature!');
                this.io.sockets.to(socket.id)
                    .emit('subscription_error', data.channel, 'Invalid signature!');
            }
        });
    }


    /**
     * Check if a channel is a presence channel.
     */
    isPresence(channel: string): boolean {
        return channel.lastIndexOf('presence-', 0) === 0;
    }

    /**
     * On join a channel log success.
     */
    onJoin(socket: any, channel: string): void {

        if (this.options.devMode) {
            Log.info(`[${new Date().toISOString()}] - ${socket.id} joined channel: ${channel}`);
        }
    }

    /**
     * Check if client is a client event
     */
    isClientEvent(event: string): boolean {
        console.log('isClientEvent')
        let isClientEvent = false;

        this._clientEvents.forEach(clientEvent => {
            let regex = new RegExp(clientEvent.replace('\*', '.*'));
            if (regex.test(event)) isClientEvent = true;
        });

        return isClientEvent;
    }

    /**
     * Check if a socket has joined a channel.
     */
    isInChannel(socket: any, channel: string): boolean {
        console.log('isInChannel')
        return !!socket.rooms[channel];
    }

    /**
     * Generate hash key using sha256 algo
     * @param socket_id
     * @param channel_name
     * @param {string} secret_key
     * @returns {string}
     */
    getSocketHash(socket_id: any, channel_name: any, secret_key: string): string {
        //creating hmac object
        var hmac = crypto.createHmac('sha256', secret_key);
        //passing the data to be hashed
        let data = hmac.update(socket_id + ':' + channel_name);
        //Creating the hmac in the required format
        let gen_hmac = data.digest('hex');

        return gen_hmac
    }

    /**
     * Get client secret from config file
     * @param {string} app_id
     * @returns {string}
     */
    async getClientSecret(app_id: string) {
        console.log('app_id', app_id);
        let client_secret = await this.db.get(app_id + "_subscription");

        return client_secret;
    }
}
