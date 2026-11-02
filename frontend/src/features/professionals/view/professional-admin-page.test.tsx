import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach,expect,it,vi} from "vitest";
import AdminProfessionalsPage from "@/app/(protected)/admin/professionals/page";
import {AppError} from "@/shared/errors/app-error";
const m=vi.hoisted(()=>({adminOrganizations:vi.fn(),adminMembers:vi.fn(),adminAudit:vi.fn(),approveMember:vi.fn()}));
vi.mock("@/services/professionals/professional-api",()=>({professionalApi:m}));
vi.mock("@/shared/components/layout/admin-shell",()=>({AdminShell:({children}:{children:React.ReactNode})=><main>{children}</main>}));
vi.mock("../components/professional-credential-review",()=>({ProfessionalCredentialReview:({organizationName}:{organizationName:string})=><section aria-label="Credential review">{organizationName}</section>}));
const org={id:"org-one",name:"Fictional One",slug:"fictional-one",status:"active",description:"Fictional",serviceHours:""};
beforeEach(()=>{vi.resetAllMocks();m.adminOrganizations.mockResolvedValue({organizations:[org]});m.adminMembers.mockResolvedValue({memberships:[]});m.adminAudit.mockResolvedValue({events:[]});m.approveMember.mockResolvedValue({membershipId:"fixture-member"});});
it("does not expose approval forms to an org_admin without verification authority",async()=>{
 m.adminOrganizations.mockRejectedValue(new AppError({code:"AUTHORIZATION_ERROR",statusCode:403,userMessage:"Verification administrator access required"}));render(<AdminProfessionalsPage/>);
 await screen.findByRole("alert");expect(screen.queryByRole("button",{name:"Approve access"})).not.toBeInTheDocument();expect(screen.queryByLabelText("ECHO user UUID")).not.toBeInTheDocument();expect(m.adminMembers).not.toHaveBeenCalled();expect(m.approveMember).not.toHaveBeenCalled();
});
it("limits the manual approval form to nonclinical roles and refreshes audit once per successful operation",async()=>{
 render(<AdminProfessionalsPage/>);const role=await screen.findByLabelText("Role");expect(screen.queryByRole("option",{name:"Counselor"})).not.toBeInTheDocument();expect(role).toHaveValue("coordinator");
 await waitFor(()=>expect(m.adminAudit).toHaveBeenCalledTimes(1));fireEvent.change(screen.getByLabelText("ECHO user UUID"),{target:{value:"fc000000-0000-4000-8000-000000000001"}});fireEvent.change(screen.getByLabelText("Display name"),{target:{value:"Fictional coordinator"}});await userEvent.click(screen.getByRole("checkbox",{name:/coordination role/}));await userEvent.click(screen.getByRole("button",{name:"Approve access"}));
 await screen.findByText("Saved. Review the status shown below.");expect(m.approveMember).toHaveBeenCalledWith({organizationId:"org-one",userId:"fc000000-0000-4000-8000-000000000001",role:"coordinator",displayName:"Fictional coordinator",credentialLabel:null,credentialExpiresAt:null,credentialChecked:true});await waitFor(()=>expect(m.adminAudit).toHaveBeenCalledTimes(2));
});
it("late organization discovery cannot restore admin forms after account invalidation",async()=>{
 let resolve!:(value:unknown)=>void;m.adminOrganizations.mockReturnValue(new Promise(yes=>{resolve=yes}));render(<AdminProfessionalsPage/>);
 act(()=>window.dispatchEvent(new Event("echo:sensitive-state-cleared")));await act(async()=>resolve({organizations:[org]}));expect(screen.queryByLabelText("ECHO user UUID")).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Add pending organization"})).not.toBeInTheDocument();
});
it("switching organizations clears an unfinished coordination approval",async()=>{
 m.adminOrganizations.mockResolvedValue({organizations:[org,{...org,id:"org-two",name:"Fictional Two",slug:"fictional-two"}]});render(<AdminProfessionalsPage/>);
 fireEvent.change(await screen.findByLabelText("Display name"),{target:{value:"Old scope draft"}});await userEvent.click(screen.getByRole("checkbox",{name:/coordination role/}));await userEvent.click(screen.getByRole("button",{name:/Fictional Two/}));
 expect(screen.getByLabelText("Display name")).toHaveValue("");expect(screen.getByRole("checkbox",{name:/coordination role/})).not.toBeChecked();expect(m.approveMember).not.toHaveBeenCalled();
});

it("keeps the selected organization and coordination draft across window switching",async()=>{
 m.adminOrganizations.mockResolvedValue({organizations:[org,{...org,id:"org-two",name:"Fictional Two",slug:"fictional-two"}]});render(<AdminProfessionalsPage/>);await screen.findByLabelText("Display name");await userEvent.click(screen.getByRole("button",{name:/Fictional Two/}));
 fireEvent.change(screen.getByLabelText("Display name"),{target:{value:"Coordinator draft"}});await userEvent.click(screen.getByRole("checkbox",{name:/coordination role/}));
 const visibility=vi.spyOn(document,"visibilityState","get").mockReturnValue("hidden");fireEvent(document,new Event("visibilitychange"));visibility.mockReturnValue("visible");fireEvent(document,new Event("visibilitychange"));fireEvent(window,new Event("focus"));
 expect(screen.getByRole("button",{name:/Fictional Two/})).toHaveAttribute("aria-pressed","true");expect(screen.getByLabelText("Display name")).toHaveValue("Coordinator draft");expect(screen.getByRole("checkbox",{name:/coordination role/})).toBeChecked();expect(m.adminOrganizations).toHaveBeenCalledTimes(1);visibility.mockRestore();
});
