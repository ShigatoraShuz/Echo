import {it,expect} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {useState} from 'react';
import {PhilippineMobileInput} from './philippine-mobile-input';
function Form(){const [value,setValue]=useState('');return <><label>Guardian mobile<PhilippineMobileInput value={value} onChange={e=>setValue(e.target.value)}/></label><output>{value}</output></>;}
it('preserves field labels and converts local input to the canonical +63 value',()=>{
 render(<Form/>);fireEvent.change(screen.getByLabelText('Guardian mobile'),{target:{value:'09171234567'}});
 expect(screen.getByRole('status')).toHaveTextContent('+639171234567');expect(screen.getByLabelText('Guardian mobile')).toHaveValue('9171234567');cleanup();
});
it('allows clearing an optional field and rejects alphabetic input',()=>{
 render(<Form/>);const field=screen.getByLabelText('Guardian mobile');fireEvent.change(field,{target:{value:'abc'}});expect(screen.getByRole('status')).toBeEmptyDOMElement();
 fireEvent.change(field,{target:{value:'+639171234567'}});fireEvent.change(field,{target:{value:''}});expect(screen.getByRole('status')).toBeEmptyDOMElement();cleanup();
});
