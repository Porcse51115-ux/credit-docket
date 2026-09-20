// example.ts — run the whole pipeline against the sandbox, no bureau access needed.
//   FIELD_MASTER_KEY=... npx tsx example.ts

import { FieldCrypto, LocalMasterKey } from "./src/crypto";
import { InMemoryProfileStore } from "./src/storage";
import { SandboxProvider } from "./src/providers/SandboxProvider";
import { MonitoringService } from "./src/service";
import { generateLetters, Sender } from "./src/letters/engine";
import { ALL_BUREAUS } from "./src/types";

async function main() {
  const crypto = new FieldCrypto(new LocalMasterKey());
  const store = new InMemoryProfileStore();
  // Simulate TransUnion timing out, to show partial handling + retries.
  const provider = new SandboxProvider(["transunion"]);
  const service = new MonitoringService(provider, crypto, store);

  const profile = await service.pullAndStore({
    consumerId: "consumer_001",
    consentToken: "demo-consent",
    bureaus: ALL_BUREAUS,
    permissiblePurpose: "consumer-initiated review (15 U.S.C. 1681b(a)(2))",
  });

  console.log("partial pull:", profile.partial);
  console.log("returned bureaus:", profile.bureausReturned);
  console.log("\ntradelines:");
  for (const t of profile.tradelines) {
    console.log(`  • ${t.creditorName} (${t.accountNumberMasked}) [${t.classification}] signals=${t.signals.join(",") || "none"} on ${t.presence.map(p => p.bureau).join("/")}`);
  }
  console.log("inquiries:", profile.inquiries.map((q) => `${q.subscriberName}@${q.bureau}`).join(", "));

  const sender: Sender = {
    name: "Jordan A. Rivera", address: "123 Maple Street",
    cityStateZip: "Allentown, PA 18101", ssnLast4: "1234", dob: "01/02/1985",
  };

  // Pick a couple of items. The collection has a real basis; one is left blank
  // on purpose to show the frivolous-basis guard skip it.
  const collection = profile.tradelines.find((t) => t.signals.includes("collection"))!;
  const oldChargeoff = profile.tradelines.find((t) => t.signals.includes("past_reporting_window"))!;
  const badInquiry = profile.inquiries.find((q) => /unknown/i.test(q.subscriberName));

  const { letters, skipped } = generateLetters(profile, sender, [
    { itemId: collection.id, reason: "incorrect_balance", assertion: "TransUnion and Equifax report different balances on the same account; I never owed this amount and have the payoff letter dated 03/2023." },
    { itemId: oldChargeoff.id, reason: "outdated" }, // self-justifying via DOFD
    // No basis on a factual claim -> the guard skips it (frivolous risk under §611(a)(3)).
    { itemId: oldChargeoff.id, reason: "not_mine" },
    ...(badInquiry ? [{ itemId: badInquiry.id, reason: "unauthorized_inquiry" as const }] : []),
  ]);

  console.log(`\ngenerated ${letters.length} letter(s); skipped ${skipped.length}:`);
  skipped.forEach((s) => console.log("  skipped:", s.reason));
  console.log("\n----- sample letter -----\n");
  console.log(letters[0]?.text);
}

main().catch((e) => { console.error(e); process.exit(1); });
