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

    getSubscription(appId)
    {
        return new Subscription(this.db).getOne(appId);
    }

    addChannelToDB(appId,channel:string)
    {
        let _that = this;
        this.db.get(this.socket.id).then(res => {
            if(!res)
            {
                let channels = Array(channel);
                _that.setSocketInfo(appId,channels);

            }
            else{
                let channels = res.channels;
                const index = channels.indexOf(channel);
                if(!(index > -1))//channel not existed
                {
                    channels.push(channel);
                    _that.setSocketInfo(appId, channels);
                }
            }
        });
    }
    removeChannelFromDB(appId,channel:string): Promise<any>
    {
        return this.db.get(this.socket.id).then(res => {
            let channelsCount = 0;
            if(res)
            {

                let channels = res.channels;
                const index = channels.indexOf(channel,0);
                if(index > -1)
                {
                    channels.splice(index,1);
                    channelsCount = channels.length;
                    if(channels.length>0)
                    {
                        this.setSocketInfo(appId,channels);
                    }
                    else
                    {
                        this.setSocketInfo(appId,null);
                    }
                }
            }
            return new Promise<any>((resolve, reject) => {
                resolve(channelsCount);
            });
        });

    }

    setSocketInfo(appId,channels=[])
    {
        this.db.set(this.socket.id,{appId:appId,channels:channels});
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
    checkOnSubscribe(data): Promise<any>
    {
        let socket = this.socket;
        let appId = data.app_id;
        return this.db.get(appId).then(async res => {
            let canSubscribe = false;
            let alreadyExisting = false;
            let error = 'failed';
            if(!res){//new application
                canSubscribe = true;
            }
            else
            {
                let sockets = res.sockets;
                if(sockets.indexOf(socket.id) > -1)//already existed
                {
                    canSubscribe = true;
                    alreadyExisting = true;
                }
                else{//new socket
                    let res0 = await this.getSubscription(appId);
                    //   res0 = {maxConnections:0};
                    if (!res0)
                    {
                        error = 'failed - no subscription found';
                    }
                    else
                    if(sockets.length >= res0.maxConnections)
                    {
                        this.incrementConnectionsDutToMaxNumbers(appId);
                        error = 'failed - reach max connections number';
                    }
                    else
                        canSubscribe = true;
                }
            }

            if(canSubscribe)
            {
                let sockets = res ? res.sockets : [];
                if(!alreadyExisting && sockets && sockets.length) sockets.push(socket.id);
                else res = {sockets:Array(socket.id)};

                if (!alreadyExisting)
                    this.incrementConnections(appId);

                this.db.set(appId,res);
                this.setSocketInfo(appId);

                this.addChannelToDB(appId,data.channel);

                return new Promise<any>((resolve, reject) => {
                    resolve('success');
                });
            }
            else
            {
                return new Promise<any>((resolve, reject) => {
                    reject(error);
                });
            }
        });
    }

    removeByApp(data)
    {
        let socket = this.socket;

        let _socket = socket;
        let appId = data.app_id;
        this.removeChannelFromDB(appId,data.channel).then(res=>{
            if(!res)
            {
                this.db.get(appId).then(appResult=> {
                    if(appResult && appResult.sockets && appResult.sockets.length > 0)
                    {
                        let sockets = appResult.sockets;

                        const index = sockets ? sockets.indexOf(_socket.id, 0) : -1;
                        if (index > -1) {
                            sockets.splice(index, 1);

                            res = {sockets:sockets};
                            this.db.set(appId,res);
                            this.setSocketInfo(null,null);
                        }
                    }
                });
            }
        });
    }

    /**  Remove without app id*/
    remove()
    {
        let _socket = this.socket;
        this.db.get(_socket.id).then(socketInfo=> {
            if(socketInfo && socketInfo.appId)
            {

                return this.removeByApp({app_id:socketInfo.appId,channel:''});
            }
        });
    }
}