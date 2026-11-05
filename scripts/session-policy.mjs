/** One session policy for supported interactive development launchers. */
export function sessionPolicyEnvironment(environment={}) {
 const keys=['ECHO_APP_PRESENCE','NEXT_PUBLIC_APP_PRESENCE'];
 for(const key of keys)if(environment[key]!==undefined&&environment[key]!=='true')throw Error('Interactive Echo startup requires '+key+'=true. Remove the conflicting legacy session setting and restart frontend and backend together.');
 return {...environment,ECHO_APP_PRESENCE:'true',NEXT_PUBLIC_APP_PRESENCE:'true'};
}
