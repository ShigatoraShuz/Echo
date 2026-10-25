import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProfessionalCredentialReview } from "./professional-credential-review";
import type { CredentialReview } from "@/services/professionals/professional-api";
import { AppError } from "@/shared/errors/app-error";
const m=vi.hoisted(()=>({adminCredentials:vi.fn(),memberships:vi.fn(),adminCredential:vi.fn(),decideCredential:vi.fn(),approveMember:vi.fn(),changed:vi.fn()}));
vi.mock("@/services/professionals/professional-api",()=>({professionalApi:m}));
const item:CredentialReview={id:"review-one",organizationId:"org-one",userId:"fictional-applicant",role:"counselor",credentialLabel:"SYNTHETIC THESIS DEMO — not a license",expiresAt:"2099-01-01",status:"pending",reviewStatus:"pending",submittedAt:"2026-10-22T00:00:00Z",reviewedAt:null,reviewedBy:null,reasonCode:null};
const props={organizationId:"org-one",organizationName:"Fictional organization",active:true,onChanged:m.changed};
const evidence="Fictional manifest reference; no real license or patient data.";
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes});return {promise,resolve};}
beforeEach(()=>{vi.resetAllMocks();m.adminCredentials.mockResolvedValue({credentials:[item]});m.memberships.mockResolvedValue({userId:"reviewer",mfaRequired:false,memberships:[]});m.adminCredential.mockResolvedValue({credential:{...item,evidenceReference:evidence}});m.decideCredential.mockResolvedValue({credential:{...item,status:"approved",reviewStatus:"approved"}});m.approveMember.mockResolvedValue({membershipId:"approved-member"});});
async function open(){await userEvent.click(await screen.findByRole("button",{name:"Review application"}));await screen.findByText(evidence);}
it("loads metadata first, audits explicit evidence access, and separates decision from membership",async()=>{
 render(<ProfessionalCredentialReview {...props}/>);await screen.findByText(item.credentialLabel);expect(m.adminCredential).not.toHaveBeenCalled();await open();
 expect(m.adminCredential).toHaveBeenCalledWith("org-one","review-one");
 expect(screen.getByText(/Synthetic thesis demonstration reference/)).toBeVisible();
 await userEvent.click(screen.getByRole("checkbox",{name:/independently checked/}));
 await userEvent.click(screen.getByRole("button",{name:"Approve synthetic reference"}));
 expect(m.decideCredential).toHaveBeenCalledExactlyOnceWith("org-one","review-one",{decision:"approved",reasonCode:null});
 await screen.findByText(/Review decision saved/);expect(m.approveMember).not.toHaveBeenCalled();expect(screen.queryByText(evidence)).not.toBeInTheDocument();
});
it("activates only the selected approved review with exact subject/role/expiry and a separate acknowledgment",async()=>{
 const approved={...item,status:"approved",reviewStatus:"approved",reviewedBy:"other-reviewer"};m.adminCredentials.mockResolvedValue({credentials:[approved]});m.adminCredential.mockResolvedValue({credential:{...approved,evidenceReference:evidence}});
 const pending=deferred<{membershipId:string}>();m.approveMember.mockReturnValue(pending.promise);render(<ProfessionalCredentialReview {...props}/>);await open();
 fireEvent.change(screen.getByLabelText("Approved professional display name"),{target:{value:"Echo Demo Counselor"}});
 const activate=screen.getByRole("button",{name:"Activate approved membership"});expect(activate).toBeDisabled();await userEvent.click(screen.getByRole("checkbox",{name:/separate membership activation/}));fireEvent.click(activate);fireEvent.click(activate);
 expect(m.approveMember).toHaveBeenCalledTimes(1);expect(m.approveMember).toHaveBeenCalledWith({organizationId:"org-one",userId:"fictional-applicant",role:"counselor",displayName:"Echo Demo Counselor",credentialLabel:item.credentialLabel,credentialExpiresAt:item.expiresAt,credentialChecked:true,credentialId:"review-one"});
 await act(async()=>pending.resolve({membershipId:"approved-member"}));expect(await screen.findByText(/Professional membership activated/)).toBeVisible();
});
it("blocks self-review and self-activation",async()=>{
 m.memberships.mockResolvedValue({userId:item.userId,mfaRequired:false,memberships:[]});render(<ProfessionalCredentialReview {...props}/>);await open();
 expect(screen.getByRole("alert")).toHaveTextContent("Another authorized reviewer");expect(screen.queryByRole("button",{name:/Approve synthetic|Activate approved/})).not.toBeInTheDocument();expect(m.decideCredential).not.toHaveBeenCalled();
});
it("org_admin without verification authority cannot load or decide applications",async()=>{
 m.adminCredentials.mockRejectedValue(new AppError({code:"AUTHORIZATION_ERROR",statusCode:403,userMessage:"private diagnostic"}));render(<ProfessionalCredentialReview {...props}/>);
 expect(await screen.findByRole("alert")).toHaveTextContent("org_admin membership alone is insufficient");expect(screen.queryByText(item.credentialLabel)).not.toBeInTheDocument();expect(m.adminCredential).not.toHaveBeenCalled();expect(m.decideCredential).not.toHaveBeenCalled();
});
it("ignores a late evidence response after switching organizations",async()=>{
 const pending=deferred<{credential:CredentialReview&{evidenceReference:string}}>();m.adminCredential.mockReturnValue(pending.promise);
 const {rerender}=render(<ProfessionalCredentialReview {...props}/>);await userEvent.click(await screen.findByRole("button",{name:"Review application"}));
 m.adminCredentials.mockResolvedValue({credentials:[]});rerender(<ProfessionalCredentialReview {...props} organizationId="org-two" organizationName="Second fictional organization"/>);
 await screen.findByText("No applications in this organization.");await act(async()=>pending.resolve({credential:{...item,evidenceReference:evidence}}));expect(screen.queryByText(evidence)).not.toBeInTheDocument();
});
it("clears evidence and pending acknowledgments on account invalidation",async()=>{
 render(<ProfessionalCredentialReview {...props}/>);await open();act(()=>window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
 expect(screen.queryByText(evidence)).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Approve synthetic reference"})).not.toBeInTheDocument();expect(JSON.stringify({...localStorage,...sessionStorage})).not.toContain(evidence);
});
it("never automatically retries an uncertain decision",async()=>{
 m.decideCredential.mockRejectedValue(new Error("transport error"));render(<ProfessionalCredentialReview {...props}/>);await open();await userEvent.click(screen.getByRole("checkbox",{name:/independently checked/}));await userEvent.click(screen.getByRole("button",{name:"Reject application"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Decision could not be confirmed");expect(screen.queryByText(evidence)).not.toBeInTheDocument();await userEvent.click(screen.getByRole("button",{name:"Refresh applications"}));await waitFor(()=>expect(m.adminCredentials).toHaveBeenCalledTimes(2));expect(m.decideCredential).toHaveBeenCalledTimes(1);
});
it("rejects mismatched organization metadata before displaying applications",async()=>{
 m.adminCredentials.mockResolvedValue({credentials:[{...item,organizationId:"foreign"}]});render(<ProfessionalCredentialReview {...props}/>);await screen.findByRole("alert");expect(screen.queryByText(item.credentialLabel)).not.toBeInTheDocument();expect(m.adminCredential).not.toHaveBeenCalled();
});

afterEach(()=>vi.restoreAllMocks());

it("Alt-Tab preserves the pending selection, acknowledgment and rejection choice without refetching",async()=>{
 render(<ProfessionalCredentialReview {...props}/>);await open();
 await userEvent.click(screen.getByRole("checkbox",{name:/independently checked/}));fireEvent.change(screen.getByLabelText("Rejection reason"),{target:{value:"invalid_evidence"}});
 const visibility=vi.spyOn(document,"visibilityState","get").mockReturnValue("hidden");fireEvent(document,new Event("visibilitychange"));
 expect(screen.queryByText(evidence)).not.toBeInTheDocument();expect(screen.getByText("Application "+item.id)).toBeVisible();expect(screen.getByRole("checkbox",{name:/independently checked/})).toBeChecked();
 visibility.mockReturnValue("visible");fireEvent(document,new Event("visibilitychange"));
 expect(screen.getByLabelText("Rejection reason")).toHaveValue("invalid_evidence");expect(screen.getByRole("button",{name:"Approve synthetic reference"})).toBeDisabled();
 expect(m.adminCredentials).toHaveBeenCalledTimes(1);expect(m.adminCredential).toHaveBeenCalledTimes(1);expect(m.decideCredential).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole("button",{name:"Reopen protected evidence"}));await screen.findByText(evidence);
 expect(m.adminCredential).toHaveBeenCalledTimes(2);expect(screen.getByRole("checkbox",{name:/independently checked/})).toBeChecked();expect(screen.getByLabelText("Rejection reason")).toHaveValue("invalid_evidence");
 expect(screen.getByRole("button",{name:"Approve synthetic reference"})).toBeEnabled();
});
it("Alt-Tab preserves an approved application's activation draft and checkbox",async()=>{
 const approved={...item,status:"approved" as const,reviewStatus:"approved" as const,reviewedBy:"other-reviewer"};m.adminCredentials.mockResolvedValue({credentials:[approved]});m.adminCredential.mockResolvedValue({credential:{...approved,evidenceReference:evidence}});
 render(<ProfessionalCredentialReview {...props}/>);await open();fireEvent.change(screen.getByLabelText("Approved professional display name"),{target:{value:"Echo Demo Counselor"}});await userEvent.click(screen.getByRole("checkbox",{name:/separate membership activation/}));
 const visibility=vi.spyOn(document,"visibilityState","get").mockReturnValue("hidden");fireEvent(document,new Event("visibilitychange"));visibility.mockReturnValue("visible");fireEvent(document,new Event("visibilitychange"));
 expect(screen.getByLabelText("Approved professional display name")).toHaveValue("Echo Demo Counselor");expect(screen.getByRole("checkbox",{name:/separate membership activation/})).toBeChecked();expect(screen.getByRole("button",{name:"Activate approved membership"})).toBeDisabled();
 await userEvent.click(screen.getByRole("button",{name:"Reopen protected evidence"}));await screen.findByText(evidence);expect(screen.getByLabelText("Approved professional display name")).toHaveValue("Echo Demo Counselor");expect(screen.getByRole("button",{name:"Activate approved membership"})).toBeEnabled();expect(m.approveMember).not.toHaveBeenCalled();
});
it("discards a late evidence response across a hide-return cycle without losing selection",async()=>{
 const result=deferred<{credential:CredentialReview&{evidenceReference:string}}>();m.adminCredential.mockReturnValueOnce(result.promise);render(<ProfessionalCredentialReview {...props}/>);await userEvent.click(await screen.findByRole("button",{name:"Review application"}));
 const visibility=vi.spyOn(document,"visibilityState","get").mockReturnValue("hidden");fireEvent(document,new Event("visibilitychange"));visibility.mockReturnValue("visible");fireEvent(document,new Event("visibilitychange"));
 await act(async()=>result.resolve({credential:{...item,evidenceReference:evidence}}));expect(screen.queryByText(evidence)).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Reopen protected evidence"})).toBeEnabled();expect(screen.getByText("Application "+item.id)).toBeVisible();
});
it("requires a fresh acknowledgment if the application changed while away",async()=>{
 render(<ProfessionalCredentialReview {...props}/>);await open();await userEvent.click(screen.getByRole("checkbox",{name:/independently checked/}));
 const visibility=vi.spyOn(document,"visibilityState","get").mockReturnValue("hidden");fireEvent(document,new Event("visibilitychange"));visibility.mockReturnValue("visible");fireEvent(document,new Event("visibilitychange"));m.adminCredential.mockResolvedValue({credential:{...item,expiresAt:"2099-12-31",evidenceReference:evidence}});
 await userEvent.click(screen.getByRole("button",{name:"Reopen protected evidence"}));await screen.findByText(evidence);expect(screen.getByRole("checkbox",{name:/independently checked/})).not.toBeChecked();expect(screen.getByRole("button",{name:"Approve synthetic reference"})).toBeDisabled();
});
it("denied evidence reopening after return still clears the retained review state",async()=>{
 render(<ProfessionalCredentialReview {...props}/>);await open();const visibility=vi.spyOn(document,"visibilityState","get").mockReturnValue("hidden");fireEvent(document,new Event("visibilitychange"));visibility.mockReturnValue("visible");fireEvent(document,new Event("visibilitychange"));
 m.adminCredential.mockRejectedValue(new AppError({code:"AUTHORIZATION_ERROR",statusCode:403,userMessage:"Access lost"}));await userEvent.click(screen.getByRole("button",{name:"Reopen protected evidence"}));await screen.findByRole("alert");expect(screen.queryByText("Application "+item.id)).not.toBeInTheDocument();expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();expect(screen.queryByText(evidence)).not.toBeInTheDocument();
});
