import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ProfessionalApplication } from "./professional-application";
import { ProfessionalCredentialForm } from "./professional-credential-form";
import { ProfessionalAccessView } from "../view/professional-access-view";
import type { CredentialReview } from "@/services/professionals/professional-api";
const m = vi.hoisted(() => ({ organizations:vi.fn(), credentials:vi.fn(), submitCredential:vi.fn(), memberships:vi.fn(), prepare:vi.fn(), verify:vi.fn(), replace:vi.fn() }));
vi.mock("@/services/professionals/professional-api", () => ({professionalApi:m}));
vi.mock("next/navigation", () => ({useRouter:()=>m,useSearchParams:()=>new URLSearchParams()}));
vi.mock("@/services/authentication/reviewer-mfa", () => ({prepareReviewerMfa:m.prepare,verifyReviewerMfa:m.verify}));
vi.mock("./professional-shell", () => ({ProfessionalShell:({children}:{children:React.ReactNode})=><main>{children}</main>,ProfessionalSkeleton:()=> <p>Checking access</p>}));
const org="fc000000-0000-4000-8000-000000000001";
const credential: CredentialReview={id:"fictional-credential",organizationId:org,userId:"applicant",role:"counselor",credentialLabel:"Fictional counseling qualification",expiresAt:"2099-01-01",status:"pending",reviewStatus:"pending",submittedAt:"2026-10-22T00:00:00Z",reviewedAt:null,reviewedBy:null,reasonCode:null};
const organizations=[{id:org,name:"Fictional organization",status:"active"}];
function deferred<T>() { let resolve!:(value:T)=>void; const promise=new Promise<T>(yes=>{resolve=yes});return {promise,resolve}; }
beforeEach(()=>{vi.resetAllMocks();m.organizations.mockResolvedValue({organizations});m.credentials.mockResolvedValue({credentials:[]});m.submitCredential.mockResolvedValue({credential});m.memberships.mockResolvedValue({userId:"applicant",mfaRequired:false,memberships:[]});});
async function fill() {
 await screen.findByRole("form",{name:"Professional application"});
 fireEvent.change(screen.getByLabelText(/^Organization/),{target:{value:org}});
 fireEvent.change(screen.getByLabelText(/^Professional role/),{target:{value:"counselor"}});
 fireEvent.change(screen.getByLabelText(/^Qualification label/),{target:{value:"  Fictional counseling qualification  "}});
 fireEvent.change(screen.getByLabelText(/^Credential expiry date/),{target:{value:"2099-01-01"}});
 fireEvent.change(screen.getByLabelText(/^Evidence reference/),{target:{value:"  Fictional approved-channel reference for testing only.  "}});
}
it("submits one strict pending application and never activates membership",async()=>{
 const pending=deferred<{credential:CredentialReview}>();m.submitCredential.mockReturnValue(pending.promise);
 render(<ProfessionalApplication userId="applicant" memberships={[]} />);await fill();
 const form=screen.getByRole("form",{name:"Professional application"});fireEvent.submit(form);fireEvent.submit(form);
 expect(m.submitCredential).toHaveBeenCalledTimes(1);
 expect(m.submitCredential).toHaveBeenCalledWith({organizationId:org,role:"counselor",credentialLabel:credential.credentialLabel,expiresAt:"2099-01-01",evidenceReference:"Fictional approved-channel reference for testing only."});
 await act(async()=>pending.resolve({credential}));
 expect(await screen.findByText(/Application submitted — pending independent review/)).toBeVisible();
 expect(screen.getByText("Pending approval")).toBeVisible();expect(screen.getByLabelText(/^Evidence reference/)).toHaveValue("");
 expect(m.replace).not.toHaveBeenCalled();expect(JSON.stringify({...localStorage,...sessionStorage})).not.toContain("Fictional approved-channel");
});
it("an applicant opts into MFA before either history or submission can be loaded",async()=>{
 m.memberships.mockResolvedValueOnce({userId:"applicant",mfaRequired:true,memberships:[]});m.prepare.mockResolvedValue({id:"fixture-factor"});m.verify.mockResolvedValue(undefined);
 render(<ProfessionalAccessView/>);await screen.findByRole("button",{name:"Verify authenticator to apply"});
 expect(m.credentials).not.toHaveBeenCalled();expect(m.prepare).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole("button",{name:"Verify authenticator to apply"}));
 fireEvent.change(await screen.findByLabelText("Authenticator code"),{target:{value:"123456"}});
 await userEvent.click(screen.getByRole("button",{name:"Verify and continue"}));
 await screen.findByRole("form",{name:"Professional application"});expect(m.verify).toHaveBeenCalledWith("fixture-factor","123456");expect(m.memberships).toHaveBeenCalledTimes(2);
});
it("preview never submits even with a live callback",async()=>{
 const submit=vi.fn();render(<ProfessionalCredentialForm preview organizations={organizations} onSubmit={submit}/>);
 fireEvent.submit(screen.getByRole("form",{name:"Synthetic credential details"}));expect(submit).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"Submit credential"})).toBeDisabled();
});
it("clears a draft on account invalidation and ignores a late receipt",async()=>{
 const pending=deferred<{credential:CredentialReview}>();m.submitCredential.mockReturnValue(pending.promise);
 render(<ProfessionalApplication userId="applicant" memberships={[]}/>);await fill();fireEvent.submit(screen.getByRole("form",{name:"Professional application"}));
 act(()=>window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
 await act(async()=>pending.resolve({credential}));expect(screen.queryByText(/Application submitted — pending/)).not.toBeInTheDocument();expect(screen.queryByLabelText(/^Evidence reference/)).not.toBeInTheDocument();
});
it("isolates late history responses from a different account",async()=>{
 const pending=deferred<{credentials:CredentialReview[]}>();m.credentials.mockReturnValueOnce(pending.promise).mockResolvedValue({credentials:[]});
 const {rerender}=render(<ProfessionalApplication userId="applicant" memberships={[]}/>);
 await waitFor(()=>expect(m.credentials).toHaveBeenCalledTimes(1));rerender(<ProfessionalApplication userId="second-account" memberships={[]}/>);
 await screen.findByText("No credential application has been submitted for this account.");await act(async()=>pending.resolve({credentials:[credential]}));expect(screen.queryByText(credential.credentialLabel)).not.toBeInTheDocument();
});
it("handles an uncertain submission with a history read, never an automatic replay",async()=>{
 m.submitCredential.mockRejectedValue(new Error("private transport text"));render(<ProfessionalApplication userId="applicant" memberships={[]}/>);await fill();fireEvent.submit(screen.getByRole("form",{name:"Professional application"}));
 expect(await screen.findByRole("alert")).not.toHaveTextContent("private transport");await userEvent.click(screen.getByRole("button",{name:"Refresh application history"}));
 await screen.findByRole("form",{name:"Professional application"});expect(m.submitCredential).toHaveBeenCalledTimes(1);expect(m.credentials).toHaveBeenCalledTimes(2);
});
it("conceals history from a response belonging to another account",async()=>{
 m.credentials.mockResolvedValue({credentials:[{...credential,userId:"different-account"}]});render(<ProfessionalApplication userId="applicant" memberships={[]}/>);
 await screen.findByRole("alert");expect(screen.queryByText(credential.credentialLabel)).not.toBeInTheDocument();expect(screen.queryByRole("form",{name:"Professional application"})).not.toBeInTheDocument();
});


it("coalesces rapid applicant MFA enrollment clicks",async()=>{
 m.memberships.mockResolvedValue({userId:"applicant",mfaRequired:true,memberships:[]});const pending=deferred<{id:string}>();m.prepare.mockReturnValue(pending.promise);render(<ProfessionalAccessView/>);
 const button=await screen.findByRole("button",{name:"Verify authenticator to apply"});fireEvent.click(button);fireEvent.click(button);expect(m.prepare).toHaveBeenCalledTimes(1);
 await act(async()=>pending.resolve({id:"fictional-factor"}));expect(await screen.findByRole("heading",{name:"Verify your authenticator"})).toBeVisible();expect(m.credentials).not.toHaveBeenCalled();
});
