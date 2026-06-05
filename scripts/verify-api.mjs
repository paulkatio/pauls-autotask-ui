// Throwaway-Skript für Phase-0-API-Verifikation gegen die Autotask-Sandbox.
// Liest Zugangsdaten aus process.env (Quotes/Sonderzeichen korrekt entpackt).
// Aufruf: node --env-file=.env.local scripts/verify-api.mjs <command> [args...]

const BASE = process.env.AUTOTASK_BASE_URL;
const headers = {
  ApiIntegrationCode: process.env.AUTOTASK_INTEGRATION_CODE,
  UserName: process.env.AUTOTASK_API_USERNAME,
  Secret: process.env.AUTOTASK_API_SECRET,
  "Content-Type": "application/json",
};

async function req(method, path, body) {
  const url = path.startsWith("http") ? path : `${BASE}/${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

function out(label, data) {
  console.log(`\n===== ${label} (HTTP ${data.status}) =====`);
  console.log(typeof data.json === "string" ? data.json : JSON.stringify(data.json, null, 2));
}

const cmd = process.argv[2];
const arg = process.argv[3];

switch (cmd) {
  case "ping": {
    out("Tickets/query MaxRecords 1", await req("POST", "Tickets/query", {
      MaxRecords: 1, Filter: [{ op: "gte", field: "id", value: 0 }],
    }));
    break;
  }
  case "fields": {
    // arg = Entity, z.B. TicketNotes, TimeEntries, Tickets
    out(`${arg}/entityInformation/fields`, await req("GET", `${arg}/entityInformation/fields`));
    break;
  }
  case "fieldsc": {
    // kompakt: Feldname [type] flags  (+ Picklist Werte falls vorhanden)
    const r = await req("GET", `${arg}/entityInformation/fields`);
    console.log(`\n===== ${arg} kompakt (HTTP ${r.status}) =====`);
    for (const f of r.json.fields ?? []) {
      const flags = [f.isRequired ? "REQ" : "", f.isReadOnly ? "RO" : "", f.isReference ? `->${f.referenceEntityType}` : "", f.isPickList ? "PICK" : ""].filter(Boolean).join(",");
      console.log(`${f.name} [${f.dataType}] ${flags}`);
      if (f.isPickList && f.picklistValues) {
        const act = f.picklistValues.filter(v => v.isActive);
        console.log("   PICK: " + act.map(v => `${v.value}=${v.label}`).join(" | "));
      }
    }
    break;
  }
  case "raw": {
    // arg = pfad ; optional body via argv[4]
    const body = process.argv[4] ? JSON.parse(process.argv[4]) : undefined;
    out(`RAW ${process.argv[5] || "GET"} ${arg}`, await req(process.argv[5] || "GET", arg, body));
    break;
  }
  case "query": {
    // arg = Entity ; argv[4] = JSON body
    const body = JSON.parse(process.argv[4]);
    out(`${arg}/query`, await req("POST", `${arg}/query`, body));
    break;
  }
  default:
    console.log("commands: ping | fields <Entity> | query <Entity> <jsonBody> | raw <path> [jsonBody] [METHOD]");
}
