import {Database} from "../database";
import {Subscription} from "../models";

export class SocketHandler {

    /**
     * Real socket
     */
    private socket: any;
    /**
     * Databse
     */
    private db: Database;
    /**
     * Create a new Socket instance.
     */
    constructor( socket , db:Database) {
        this.socket = socket;
        this.db = db;
    }

    incrementConnections(appId)
    {
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var yyyy = today.getFullYear();
        this.db.incr(appId+'_'+yyyy+'-'+mm+'-'+dd);
    }
    incrementConnectionsDutToMaxNumbers(appId)
    {
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var yyyy = today.getFullYear();
        this.db.incr(appId+'_failed_max_connections_'+'_'+yyyy+'-'+mm+'-'+dd);
    }

    connect(appId): Promise<any>
    {
        this.incrementConnections(appId);
        return this.db.get(appId+'_subscription').then(async (res)=>{
            if(!res)
                throw 'No subscribtion found';
            let currentInfo = await this.db.get(appId+'_current_connections');
            if(currentInfo && (currentInfo+1)>res.maxConnections){
                this.incrementConnectionsDutToMaxNumbers(appId);
                throw 'Reach max connections';
            }
            return new Promise<any>((resolve, reject) => {

                this.db.incr(appId+'_current_connections');
                resolve('success');
            });
        });

    }

    disconnect(appId)
    {
        let key = appId+'_current_connections';
        this.db.decr(key);
    }
}