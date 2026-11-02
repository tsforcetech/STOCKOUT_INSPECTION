import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AcceptInvitationPage from "../accept-invitation-page";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch, type MockRoute } from "@/test/http";

afterEach(() => vi.unstubAllGlobals());

const routes = [
  { path: "/platform/invitation", element: <AcceptInvitationPage /> },
  { path: "/login", element: <div>Login screen</div> },
  { path: "/", element: <div>Dashboard home</div> },
];
const validate = (accountState: string, invitedEmail = "admin@stockout.test"): MockRoute => ({
  method: "POST",
  path: "/api/v1/auth/invitations/validate",
  respond: () => ({ body: { invitedEmail, expiresAtUtc: "2026-10-27T10:00:00", accountState } }),
});
const accept: MockRoute = { method: "POST", path: "/api/v1/platform/invitations/accept", respond: () => ({ body: { success: true, data: {} } }) };

describe("AcceptInvitationPage", () => {
  it("new user: creates the account here, which accepts the invitation and signs in", async () => {
    const { calls } = mockFetch([
      validate("NEW", "new.admin@stockout.test"),
      {
        method: "POST",
        path: "/api/v1/auth/invitations/register",
        respond: () => ({ status: 201, body: { accessToken: "a.eyJzaWQiOiJzMSJ9.c", refreshToken: "rt", expiresIn: 900, tokenType: "Bearer", userId: "u-1", firstName: "Nora", lastName: "New", displayName: "Nora New", invitationAccepted: true } }),
      },
      ...sessionRoutes([]).slice(1),
    ]);
    const { router } = renderWithApp(routes, "/platform/invitation?token=tok-1");
    expect(await screen.findByDisplayValue("new.admin@stockout.test")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/First name/), "Nora");
    await userEvent.type(screen.getByLabelText(/Last name/), "New");
    await userEvent.type(screen.getByLabelText(/^Password/), "correct-horse-battery");
    await userEvent.type(screen.getByLabelText(/Confirm password/), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Create account and accept" }));
    expect(await screen.findByText("You're in")).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname === "/api/v1/auth/invitations/register")!.body).toMatchObject({ invitationToken: "tok-1", firstName: "Nora", lastName: "New", displayName: "Nora New", password: "correct-horse-battery", mobile: null });
    expect(calls.some((c) => c.url.pathname === "/api/v1/platform/invitations/accept")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Open the admin console" }));
    expect(router.state.location.pathname).toBe("/");
  });

  it("existing user: log in with the invited email, then come back and accept automatically", async () => {
    mockFetch([validate("EXISTING_VERIFIED")]);
    renderWithApp(routes, "/platform/invitation?token=tok-2");
    const login = await screen.findByRole("link", { name: "Log in to accept" });
    const href = new URL(login.getAttribute("href")!, "http://x");
    expect(href.pathname).toBe("/login");
    expect(href.searchParams.get("email")).toBe("admin@stockout.test");
    expect(href.searchParams.get("next")).toBe("/platform/invitation?token=tok-2&accept=1");
  });

  it("signed in as the invited user after login: accepts without another click", async () => {
    sessionStorage.setItem("stockout.inspection.rt", "rt-1");
    const { calls } = mockFetch([...sessionRoutes([]), validate("EXISTING_VERIFIED"), accept]);
    renderWithApp(routes, "/platform/invitation?token=tok-2&accept=1");
    expect(await screen.findByText("You're in")).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname === "/api/v1/platform/invitations/accept")!.body).toEqual({ token: "tok-2" });
  });

  it("unverified account: offers to resend the verification email", async () => {
    const { calls } = mockFetch([validate("EXISTING_UNVERIFIED"), { method: "POST", path: "/api/v1/auth/verification/email/send", respond: () => ({ body: { message: "sent" } }) }]);
    renderWithApp(routes, "/platform/invitation?token=tok-3");
    await userEvent.click(await screen.findByRole("button", { name: "Send verification email" }));
    expect(await screen.findByRole("button", { name: "Verification email sent" })).toBeDisabled();
    expect(calls.find((c) => c.url.pathname === "/api/v1/auth/verification/email/send")!.body).toEqual({ email: "admin@stockout.test" });
  });

  it("signed in with a different account: says so and offers to log out", async () => {
    sessionStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch([...sessionRoutes([]), validate("EXISTING_VERIFIED", "someone.else@stockout.test")]);
    renderWithApp(routes, "/platform/invitation?token=tok-4");
    expect(await screen.findByText("You're signed in with a different account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out and continue" })).toBeInTheDocument();
  });

  it("explains an expired invitation and a missing token", async () => {
    mockFetch([{ method: "POST", path: "/api/v1/auth/invitations/validate", respond: () => ({ status: 409, body: { title: "Expired", status: 409, detail: "Invitation has expired." } }) }]);
    renderWithApp(routes, "/platform/invitation?token=old");
    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation has expired");
  });
});
