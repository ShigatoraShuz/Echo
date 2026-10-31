import {describe,it,expect} from 'vitest';
import {httpOnlyMode} from '../http-only-mode.js';
describe('development HTTP-only startup',()=>{
 it('retains normal background startup by default',()=>{expect(httpOnlyMode('development',undefined)).toBe(false);expect(httpOnlyMode('production','0')).toBe(false);});
 it('allows explicit development isolation',()=>expect(httpOnlyMode('development','1')).toBe(true));
 it('rejects production or test suppression',()=>{for(const mode of ['production','test'])expect(()=>httpOnlyMode(mode,'1')).toThrow();});
 it('rejects ambiguous flags',()=>expect(()=>httpOnlyMode('development','true')).toThrow());
});
