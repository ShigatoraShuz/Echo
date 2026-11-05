import {it,expect} from 'vitest';
import {normalizePhilippineMobile,philippineMobileSchema} from '@echo/contracts';
it.each(['09171234567','9171234567','639171234567','+63 917 123 4567','(+63) 917-123-4567'])('normalizes %s',value=>expect(philippineMobileSchema.parse(value)).toBe('+639171234567'));
it.each(['','911','+12025550100','+6309171234567','0917123456','091712345678','09171234567 ext 1','abc','+63+9171234567'])('rejects %s',value=>{expect(normalizePhilippineMobile(value)).toBeNull();expect(philippineMobileSchema.safeParse(value).success).toBe(false);});
