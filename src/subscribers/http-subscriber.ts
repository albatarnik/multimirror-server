import { Database } from '../database';
import { Log } from './../log';
import { Subscriber } from './subscriber';
var url = require('url');

export class HttpSubscriber implements Subscriber {
    
    /**
     * Create new instance of http subscriber.
     *
     * @param  {any} express
     */
    constructor(private express, private options,private db) { }

    /**
     * Subscribe to events to broadcast.
     *
     * @return {void}
     */
    subscribe(callback): Promise<any> {
        return new Promise((resolve, reject) => {
            // Broadcast a message to a channel
            this.express.post('/apps/:appId/events', (req, res) => {
                let body: any = [];
                res.on('error', (error) => {
                    if (this.options.devMode) {
                        Log.error(error);
                    }
                });

                req.on('data', (chunk) => body.push(chunk))
                    .on('end', () => this.handleData(req, res, body, callback));
            });

            Log.success('Listening for http events...');

            resolve();
        });
    }

    /**
     * Unsubscribe from events to broadcast.
     *
     * @return {Promise}
     */
    unsubscribe(): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                this.express.post('/apps/:appId/events', (req, res) => {
                    res.status(404).send();
                });
                resolve();
            } catch(e) {
                reject('Could not overwrite the event endpoint -> ' + e);
            }
        });
    }

    /**
     * Handle incoming event data.
     *
     * @param  {any} req
     * @param  {any} res
     * @param  {any} body
     * @param  {Function} broadcast
     * @return {boolean}
     */
    handleData(req, res, body, broadcast): boolean {
        body = JSON.parse(Buffer.concat(body).toString());

        if ((body.channels || body.channel) && body.name && body.data) {

            var data = body.data;
            try {
                data = JSON.parse(data);
            } catch (e) { }

            var message = {
                event: body.name,
                data: data,
                socket: body.socket_id
            }
            var channels = body.channels || [body.channel];

            if (this.options.devMode) {
                Log.info("Channel: " + channels.join(', '));
                Log.info("Event: " + message.event);
                Log.info("App: " + req.params.appId);
            }
            this.increaseMessages(req.params.appId);
            channels.forEach(channel => broadcast(channel, message));
        } else {
            return this.badResponse(
                req,
                res,
                'Event must include channel, event name and data'
            );
        }

        res.json({ message: 'ok' })
    }

    increaseMessages(appId)
    {
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var yyyy = today.getFullYear();
        this.db.incr(appId+'_messages_'+yyyy+'-'+mm+'-'+dd);
    }

    /**
     * Handle bad requests.
     *
     * @param  {any} req
     * @param  {any} res
     * @param  {string} message
     * @return {boolean}
     */
    badResponse(req: any, res: any, message: string): boolean {
        res.statusCode = 400;
        res.json({ error: message });

        return false;
    }
}
