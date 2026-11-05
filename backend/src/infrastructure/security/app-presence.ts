import {resolve} from 'node:path';
import {SessionPresenceStore} from './session-presence.js';
let store:SessionPresenceStore|undefined;
export function appPresence(){
 if(process.env.ECHO_APP_PRESENCE!=='true')return undefined;
 return store??=new SessionPresenceStore(resolve(process.env.LOCAL_DATA_DIR||'../local-data','app-sessions'));
}
