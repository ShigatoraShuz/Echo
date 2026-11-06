import {jsonRepository} from './json-repository.js';
import { randomUUID } from "node:crypto";
import {talkDeliverySchema} from "@echo/contracts";
import { z } from "zod";
import { NotFoundError } from "../../shared/errors/app-error.js";
const schema = z.object({ storageRevision:z.number().int().nonnegative().optional(),storageGeneration:z.number().int().nonnegative().optional(),provenance: z.array(z.record(z.string(), z.unknown())).default([]), id: z.string().uuid(), user_id: z.string().uuid(), title: z.string(), preview: z.string(), archived: z.boolean(), pinned_at: z.string().nullable(), last_message_at: z.string().nullable(), created_at: z.string(), supportRequired: z.boolean().default(false), messages: z.array(z.object({ id: z.string(), role: z.enum(['user', 'buddy']), delivery:talkDeliverySchema.optional(), content: z.string(), timestamp: z.string() })) });
export class LocalBuddyStore {
    private repo:ReturnType<typeof jsonRepository>;
    readonly ready:Promise<void>;
    close(){return this.repo.close();}
    constructor(readonly root:string){this.repo=jsonRepository(root);this.repo.register('buddy',x=>schema.parse(x));this.ready=this.repo.ready;}
    generation(user:string){return this.repo.generation(user);}
    list(user:string,strict=false){return this.repo.list(user,'buddy',strict).map(x=>schema.parse(x));}
    history(user:string,options:{page:number;pageSize:number;query:string}){return this.repo.summaryPage(user,options);}
    get(user:string,id:string){const raw=this.repo.get(user,'buddy',id);if(!raw)throw new NotFoundError('Local conversation unavailable.');return schema.parse(raw);}
    async save(value:z.infer<typeof schema>){return schema.parse(await this.repo.put('buddy',schema.parse(value)));}
    async mutate(user:string,id:string,change:(value:z.infer<typeof schema>)=>z.infer<typeof schema>){return schema.parse(await this.repo.mutate('buddy',user,id,value=>change(schema.parse(value))));}
    async create(user:string){return this.save({id:randomUUID(),user_id:user,title:'Buddy conversation',preview:'',archived:false,pinned_at:null,last_message_at:null,created_at:new Date().toISOString(),supportRequired:false,messages:[],provenance:[],storageGeneration:this.generation(user)});}
    async remove(user:string,id:string){this.get(user,id);await this.repo.remove(user,'buddy',id);return {deleted:true};}
    async clear(user:string){await this.repo.clear(user);}
}
