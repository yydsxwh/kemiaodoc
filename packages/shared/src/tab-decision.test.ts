import assert from "node:assert/strict";
import {
  multiAccountTabsEnabled,
  permissionRoles,
  planAddAccount,
  legacyFallback,
  planLogout,
  planResume,
  planRoleSwitch,
  resolveAccess,
  type AccountRecord,
  type BrokerState,
} from "./tab-decision";

assert.equal(multiAccountTabsEnabled({}), false);
assert.equal(multiAccountTabsEnabled({ MULTI_ACCOUNT_TABS: "false" }), false);
assert.equal(multiAccountTabsEnabled({ MULTI_ACCOUNT_TABS: "true" }), true);

const TAB_ADMIN = "tabcontextadmin0001";
const TAB_STUDENT = "tabcontextstud00003";

function person(partial: Pick<AccountRecord, "sessionId" | "userId" | "grantedRoles" | "defaultRole">): AccountRecord {
  return {
    active: true,
    pendingReview: false,
    authTimeSec: 1_700_000_000,
    display: {
      name: partial.userId,
      kkNumber: null,
      emailMasked: "",
      phoneMasked: "",
      avatarUrl: "",
      subHint: partial.userId,
    },
    ...partial,
  };
}

const state: BrokerState = {
  explicitPick: true,
  defaultSessionId: null,
  accounts: [
    person({ sessionId: "sess-admin", userId: "usr_admin", grantedRoles: ["ADMIN"], defaultRole: "ADMIN" }),
    person({ sessionId: "sess-student", userId: "usr_student", grantedRoles: ["STUDENT"], defaultRole: "STUDENT" }),
  ],
  tabs: [
    { contextId: TAB_ADMIN, sessionId: "sess-admin", activeRole: "ADMIN", revoked: false },
    { contextId: TAB_STUDENT, sessionId: "sess-student", activeRole: "STUDENT", revoked: false },
  ],
};
const left = resolveAccess(state, { tabHeader: TAB_ADMIN });
const right = resolveAccess(state, { tabHeader: TAB_STUDENT });
assert.equal(left.kind, "ready");
assert.equal(right.kind, "ready");
if (left.kind === "ready" && right.kind === "ready") {
  assert.notEqual(left.account.userId, right.account.userId);
  assert.deepEqual(right.permissionRoles, ["STUDENT"]);
}
assert.equal(resolveAccess(state, { tabHeader: null }).kind, "ambiguous");

const studentSwitch = planRoleSwitch(state, { contextId: TAB_STUDENT, role: "ADMIN" });
assert.equal(studentSwitch.mutations.length, 0);
if (studentSwitch.decision.kind === "ready") {
  assert.deepEqual(studentSwitch.decision.permissionRoles, ["STUDENT"]);
  assert.equal(studentSwitch.decision.activeRole, "STUDENT");
}
assert.deepEqual(permissionRoles(
  state.accounts[1],
  "ADMIN",
), ["STUDENT"]);

const adminPerson = {
  ...state.accounts[0],
  grantedRoles: ["ADMIN", "STUDENT"],
  defaultRole: "ADMIN",
};
const adminWorkbench = planRoleSwitch(
  { ...state, accounts: [adminPerson, state.accounts[1]] },
  { contextId: TAB_ADMIN, role: "STUDENT" },
);
assert.equal(adminWorkbench.mutations.length, 1);
if (adminWorkbench.decision.kind === "ready") {
  assert.deepEqual(adminWorkbench.decision.permissionRoles, ["STUDENT"]);
  assert.equal(adminWorkbench.decision.permissionRoles.includes("ADMIN"), false);
}

const switched = planResume(state, { contextId: TAB_STUDENT, selectSessionId: "sess-admin" });
assert.equal(switched.mutations.length, 1);
assert.equal(switched.mutations[0]?.op, "bind");
if (switched.mutations[0]?.op === "bind") {
  assert.equal(switched.mutations[0].contextId, TAB_STUDENT);
  assert.equal(switched.mutations[0].sessionId, "sess-admin");
}
assert.equal(
  switched.mutations.some((item) => item.op === "bind" && item.contextId === TAB_ADMIN),
  false,
);
const untouched = resolveAccess(state, { tabHeader: TAB_ADMIN });
if (untouched.kind === "ready") assert.equal(untouched.account.userId, "usr_admin");

const added = planAddAccount(state, {
  contextId: TAB_STUDENT,
  account: person({
    sessionId: "sess-third",
    userId: "usr_third",
    grantedRoles: ["STUDENT"],
    defaultRole: "STUDENT",
  }),
});
assert.deepEqual(
  added.state.accounts.map((item) => item.userId).sort(),
  ["usr_admin", "usr_student", "usr_third"],
);
assert.equal(added.mutations.filter((item) => item.op === "bind").length, 1);

const logoutTab = planLogout(state, { scope: "tab", contextId: TAB_STUDENT });
assert.deepEqual(logoutTab.mutations, [{ op: "clear-tab", contextId: TAB_STUDENT }]);
const signedOut: BrokerState = {
  ...state,
  tabs: [
    state.tabs[0],
    { contextId: TAB_STUDENT, sessionId: null, activeRole: "", revoked: false },
  ],
};
assert.equal(resolveAccess(signedOut, { tabHeader: TAB_STUDENT }).kind, "anonymous");
const adminStill = resolveAccess(signedOut, { tabHeader: TAB_ADMIN });
if (adminStill.kind === "ready") {
  assert.equal(adminStill.account.userId, "usr_admin");
  assert.deepEqual(adminStill.permissionRoles, ["ADMIN"]);
}
assert.equal(resolveAccess(signedOut, { tabHeader: null }).kind, "ambiguous");
const resumeSignedOut = planResume(signedOut, { contextId: TAB_STUDENT });
assert.equal(resumeSignedOut.decision.kind, "anonymous");
assert.equal(resumeSignedOut.mutations.length, 0);
const otherTabStillLogsIn = planResume(
  {
    explicitPick: false,
    defaultSessionId: null,
    accounts: [state.accounts[1]],
    tabs: [{ contextId: TAB_STUDENT, sessionId: null, activeRole: "", revoked: false }],
  },
  { contextId: TAB_ADMIN },
);
assert.equal(otherTabStillLogsIn.decision.kind, "ready");
if (otherTabStillLogsIn.decision.kind === "ready") {
  assert.equal(otherTabStillLogsIn.decision.account.userId, "usr_student");
}

assert.deepEqual(planLogout(state, { scope: "account", contextId: TAB_STUDENT }).mutations, [
  { op: "revoke-session", sessionId: "sess-student" },
]);
assert.deepEqual(planLogout(state, { scope: "account", sessionId: "sess-admin" }).mutations, [
  { op: "revoke-session", sessionId: "sess-admin" },
]);
const logoutBrowser = planLogout(state, { scope: "browser" });
assert.deepEqual(
  logoutBrowser.mutations.map((item) => (item.op === "revoke-session" ? item.sessionId : item.op)).sort(),
  ["revoke-device", "sess-admin", "sess-student"].sort(),
);
assert.equal(planLogout(state, { scope: "tab", contextId: "short" }).mutations.length, 0);

const emptyDevice: BrokerState = {
  explicitPick: false,
  defaultSessionId: null,
  accounts: [],
  tabs: [],
};
assert.equal(legacyFallback(emptyDevice, resolveAccess(emptyDevice, { tabHeader: null })), true);
const expiredOnly: BrokerState = {
  ...state,
  accounts: state.accounts.map((account) => ({ ...account, active: false })),
  tabs: [],
};
assert.equal(legacyFallback(expiredOnly, resolveAccess(expiredOnly, { tabHeader: null })), true);
assert.equal(legacyFallback(signedOut, resolveAccess(signedOut, { tabHeader: TAB_STUDENT })), false);
assert.equal(legacyFallback(state, resolveAccess(state, { tabHeader: TAB_STUDENT })), false);

console.log("www tab-decision isolation ok");
