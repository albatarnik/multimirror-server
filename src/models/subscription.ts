import {Database} from "../database";


export class Subscription {
    /**
     * Databse
     */
    private db: Database;


    /**
     * Create a new Subscription instance.
     */
    constructor( db:Database) {
        this.db = db;
    }

    getOne(appId): Promise<any>
    {
        return this.db.get(appId+'_subscription');
    }

}