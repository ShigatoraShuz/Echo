import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {beforeEach,it,expect,vi} from "vitest";
import {ProfessionalCredentialCorrection} from "./professional-credential-correction";
import type {CredentialReview} from "@/services/professionals/professional-api";
const m=vi.hoisted(()=>({correctCredential:vi.fn()}));
vi.mock("@/services/professionals/professional-api",()=>({professionalApi:m}));
const credential:CredentialReview={id:"one",organizationId:"org",userId:"owner",role:"counselor",credentialLabel:"Counselor",expiresAt:"2099-12-29",status:"pending",reviewStatus:"pending",submittedAt:"2026-10-23",reviewedAt:null,reviewedBy:null,reasonCode:null};
beforeEach(()=>vi.resetAllMocks());
it("updates one existing ID and coalesces repeated submit",async()=>{
 let resolve!:(v:unknown)=>void;m.correctCredential.mockReturnValue(new Promise(r=>{resolve=r}));const saved=vi.fn();render(<ProfessionalCredentialCorrection credential={credential} onSaved={saved}/>);
 fireEvent.click(screen.getByRole("button",{name:"Correct pending application"}));fireEvent.change(screen.getByLabelText("Corrected qualification label"),{target:{value:"SYNTHETIC THESIS DEMO — NOT A LICENSE"}});
 const form=screen.getByRole("form");fireEvent.submit(form);fireEvent.submit(form);expect(m.correctCredential).toHaveBeenCalledTimes(1);expect(m.correctCredential).toHaveBeenCalledWith("one",{credentialLabel:"SYNTHETIC THESIS DEMO — NOT A LICENSE",expiresAt:"2099-12-29"});
 resolve({credential});await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));
});
it("does not retry a failed or wrong-account correction",async()=>{m.correctCredential.mockResolvedValue({credential:{...credential,userId:"other"}});const saved=vi.fn();render(<ProfessionalCredentialCorrection credential={credential} onSaved={saved}/>);fireEvent.click(screen.getByRole("button"));fireEvent.submit(screen.getByRole("form"));expect(await screen.findByRole("alert")).toHaveTextContent("Refresh application history");expect(saved).not.toHaveBeenCalled();expect(m.correctCredential).toHaveBeenCalledTimes(1);});
it("never offers changes to reviewed applications",()=>{render(<ProfessionalCredentialCorrection credential={{...credential,reviewStatus:"approved"}} onSaved={vi.fn()}/>);expect(screen.queryByRole("button")).toBeNull();});
