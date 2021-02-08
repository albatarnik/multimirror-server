import {Database} from "../database";

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
        var hour = String(today.getHours() + 1).padStart(2, '0');
        this.db.incr(appId+'_'+yyyy+'-'+mm+'-'+dd+' '+hour+':00:00');
    }
    incrementConnectionsDutToMaxNumbers(appId)
    {
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var yyyy = today.getFullYear();
        var hour = String(today.getHours() + 1).padStart(2, '0');
        this.db.incr(appId+'_failed_max_connections_'+yyyy+'-'+mm+'-'+dd+' '+hour+':00:00');
    }


    protected async getCurrentConnections(appKey): Promise<any> {
        let res = 0;
        let info = await this.db.get(appKey+'_subscription');
        if(info)
        {
            let userApps = await this.db.get(info.user_id+'_user_apps');

            if(userApps)
            {
                for (let i = 0 ; i < userApps.length ; i++ )
                {
                    let app = userApps[i];

                    let _res = await this.db.get(app+'_current_connections');
                    if(_res)res = res + _res;
                }
            }
        }
        return new Promise<any>((resolve, reject) => {

            resolve(res);
        });;
    }

    connect(appId): Promise<any>
    {

        this.incrementConnections(appId);
        return this.db.get(appId+'_subscription').then(async (res)=>{
            if(!res)
                throw 'No subscription found';
            let currentConn = await this.getCurrentConnections(appId);

            if(currentConn && (currentConn+1)>res.maxConnections){
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