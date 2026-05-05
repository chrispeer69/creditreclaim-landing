# CreditReclaim — Dispute Letter Library Authoring Brief

**For:** External AI authoring agent (Manus)
**Output:** A single valid JSON array, ready to drop into `scripts/letters-source.json`.
**Do not** include commentary, markdown wrappers, prose preamble, or trailing notes. The agent's response must be parseable as JSON on its own.

---

## 1. Project Context

CreditReclaim is an education-first credit-repair SaaS. Users either run their own credit-repair campaigns (DIY tier) or hire CreditReclaim to run them (Managed tier). Both tiers depend on the same letter library — DIY users read each letter, fill in the placeholders, and mail it themselves; Managed users have CreditReclaim's team do the same on their behalf.

**Strategic positioning.** The product is built around a trifecta of legal mechanisms that, used in sequence, are the only credit-repair moves that consistently win:

1. **Debt validation** — under FDCPA §1692g, debt collectors must verify a debt within 30 days of being asked or stop collecting. Most collectors of resold/aged debt cannot validate, and the debt becomes uncollectable.
2. **Dispute challenges** — under FCRA §611, credit bureaus must investigate disputed items within 30 days. Items that cannot be verified must be deleted.
3. **The 30-day forced response** — the same FCRA §611 clock works as a removal lever: if the bureau misses the 30-day window, the item must come off whether it's accurate or not. Every letter that starts the clock is a tool for forced removal.

These three plays cover ~80% of consumer credit-repair scenarios. The remaining 20% is edge cases (identity theft, mixed files, statute-of-limitations defenses, FCRA/FDCPA litigation escalation) that need their own dedicated letters. The library must cover both.

**Audience.** Adults who have at least one negative item on their credit report and want it gone. Most are not lawyers. Many have never written a formal letter. They need each letter to (a) tell them when to use it, (b) explain the legal mechanism in plain language so they understand what they're doing, and (c) walk them through sending it correctly.

**Tone.** Educational, professional, accessible. Every letter cites the relevant federal statute by section number. Every explanation says *why* a law works the way it does, not just that it does. No marketing fluff. No "we'll fix everything" language. The library treats users as adults learning to operate a legal lever — because that's what they are.

---

## 2. Required Output Format

Return a **single JSON array**. Each element is one letter object with this exact schema:

```json
{
  "number": 1,
  "stage": "Stage 1: Initial Disputes - Direct to Bureaus",
  "category": "Inaccurate Account",
  "title": "Basic Dispute - Inaccurate Account",
  "when_to_use": "Multi-paragraph string describing when this letter is the right move. Plain text, line breaks with \\n. Use bullet points (rendered as lines starting with '• ') when listing scenarios.",
  "why_it_works": "Multi-paragraph string explaining the legal mechanism. Cite the relevant FCRA / FDCPA section. Explain why the law forces the outcome we want.",
  "how_to_use": "Multi-paragraph string with step-by-step instructions. Use 'STEP 1:', 'STEP 2:' format. Always include a MAILING block with certified-mail instructions and (where relevant) bureau or collector addresses. Always include a TIMING line.",
  "template_body": "The actual letter text the user will mail. Use [Bracketed Placeholders] for every field the user must fill in. Include sender block, date, recipient block, Re: line, salutation, body, requests, signature block, enclosures list."
}
```

**Field rules:**

- `number` — integer, unique, sequential 1..N. Order corresponds to recommended use order within each stage.
- `stage` — exactly one of these three strings (no variations):
  - `"Stage 1: Initial Disputes - Direct to Bureaus"`
  - `"Stage 2: Escalation & Collector Disputes"`
  - `"Stage 3: Legal — Attorney-Level Demands"`
- `category` — short label (1–4 words) used for filtering in the dashboard. Examples: `"Inaccurate Account"`, `"Method of Verification"`, `"Debt Validation"`, `"Cease & Desist"`, `"Pay-for-Delete"`, `"Goodwill"`, `"FCRA Violation"`, `"FDCPA Violation"`, `"Identity Theft"`, `"SOL Defense"`, `"Late Payment"`, `"Charge-Off"`, `"Collection"`, `"Inquiry"`, `"Public Record"`, `"Mixed File"`, `"Medical Debt"`, `"CFPB Complaint"`, `"State AG Complaint"`, `"FTC Complaint"`, `"Pre-Litigation"`. Keep labels consistent across letters in the same family.
- `title` — short descriptive title under 80 characters. Pattern: `"Action - Specific Situation"` (e.g. `"Dispute Late Payments (60+ Days)"`).
- All four content fields (`when_to_use`, `why_it_works`, `how_to_use`, `template_body`) are **strings**, not arrays. Use `\n` for line breaks.

**Strings must be valid JSON.** Escape internal double quotes as `\"`. Never use smart quotes. Em-dashes (`—`) are fine.

---

## 3. Depth Exemplars — WRITE EVERY LETTER WITH THIS LEVEL OF DEPTH

These three letters are pulled verbatim from the existing library. Match this depth. Letters that are shorter or vaguer than these will be rejected.

### Exemplar A — Letter 1 (Stage 1, simplest)

```json
{
  "number": 1,
  "stage": "Stage 1: Initial Disputes - Direct to Bureaus",
  "category": "Inaccurate Account",
  "title": "Basic Dispute - Inaccurate Account",
  "when_to_use": "• You have a negative item on your credit report that is inaccurate\n    • Account information (balance, status, dates) is wrong\n    • Item belongs to someone else (wrong person) or is a duplicate\n    • You want to start the formal dispute process\n    • First contact with the bureau about an item\n    • Use THIS LETTER FIRST for any inaccuracy",
  "why_it_works": "• This letter triggers the bureau's legal obligation to investigate under FCRA Section 611\n    • Bureaus MUST respond within 30 days per federal law\n    • Forces creditor to re-verify or the item gets deleted\n    • Simple, professional language that bureaus understand\n    • Creates paper trail proving you disputed properly\n    • Sets legal foundation for further action if needed",
  "how_to_use": "STEP 1: Identify what's wrong on your credit report\n    STEP 2: Fill in [BRACKETED] information with YOUR details\n    STEP 3: Be specific about WHAT is wrong and WHY\n    STEP 4: Print on plain white paper\n    STEP 5: Sign and date the letter\n    STEP 6: Make 2 copies - keep 1, send 1 certified mail to each bureau\n    STEP 7: Keep all documentation in a folder\n    STEP 8: Wait 30 days for response\n    STEP 9: If not removed, send Letter 2 (MOV Request)\n    \n    MAILING:\n    Send certified mail with return receipt to:\n    Equifax: P.O. Box 740241, Atlanta, GA 30374\n    Experian: P.O. Box 4500, Allen, TX 75013\n    TransUnion: 555 W. Adams Street, Chicago, IL 60661",
  "template_body": "[Your Name]\n[Your Address]\n[City, State ZIP]\n[Your Email Address]\n[Your Phone Number]\n\n[Date]\n\n[Bureau Name - Equifax, Experian, or TransUnion]\n[Bureau Address]\n[City, State ZIP]\n\nRe: DISPUTE OF INACCURATE INFORMATION ON CREDIT REPORT\n\nConsumer Name: [Your Full Legal Name]\nSocial Security Number: XXX-XX-[Last 4 Digits]\nDate of Birth: [MM/DD/YYYY]\n\nDear [Bureau Name]:\n\nI am writing to formally dispute inaccurate information on my credit report under Section 611 of the Fair Credit Reporting Act (FCRA). I request that you conduct a prompt investigation of the following item(s) and correct any inaccurate information.\n\nITEM IN DISPUTE:\nAccount Name: [Creditor Name]\nAccount Number: [Account Number - if known]\nAccount Type: [Credit Card/Loan/Mortgage/Other]\nReported Balance: [Amount shown]\nStatus Shown: [Status on report]\n\nREASON FOR DISPUTE:\n[Explain specifically what is wrong. Examples:\n- \"This account shows a late payment in [Month/Year] but I paid on time\"\n- \"The balance shown is incorrect - I paid this account in full\"\n- \"This account is a duplicate and appears twice\"\n- \"This account belongs to [other person's name] not me\"\n- \"The charge-off date is wrong - account was current\"]\n\nI am requesting that you:\n1. Conduct a complete investigation of this disputed item\n2. Contact the creditor and request verification of accuracy\n3. Remove the item if it cannot be verified as accurate\n4. Send me a corrected copy of my credit report\n5. Notify all three bureaus if information is corrected\n\nUnder FCRA Section 611, you are required to complete this investigation within 30 days and notify me of the results. I look forward to your prompt response.\n\nSincerely,\n\n[Your Signature]\n[Your Printed Name]\n\nEnclosures:\n- Copy of your Credit Report with disputed item marked\n- Copy of ID (Driver's License front and back)\n- Any supporting documentation"
}
```

### Exemplar B — Letter 2 (Stage 1, follow-up to Letter 1)

```json
{
  "number": 2,
  "stage": "Stage 1: Initial Disputes - Direct to Bureaus",
  "category": "Method of Verification",
  "title": "Round 1 - Method of Verification (MOV) Dispute",
  "when_to_use": "• After Letter 1, if item was \"verified\" by bureau (not removed)\n    • Bureau claims to have verified but item is still wrong\n    • You want to force creditor to prove how they verified\n    • You want to challenge the verification method used\n    • Item remains on report after first dispute attempt\n    • Creditor likely cannot properly verify outdated/inaccurate info",
  "why_it_works": "• Forces bureau to show PROOF of how they verified (Method of Verification)\n    • Many creditors cannot prove proper verification\n    • If no verification method used, item must be deleted\n    • Creates stronger legal argument for deletion\n    • Shows creditor potentially violated FCRA verification requirements\n    • Often leads to deletion when creditor cannot prove verification\n    • Sets up better position for Letter 3 if needed",
  "how_to_use": "STEP 1: Get bureau's response to Letter 1\n    STEP 2: If item still on report, prepare this letter\n    STEP 3: Reference the original dispute and bureau's response\n    STEP 4: Specifically ask HOW bureau verified the information\n    STEP 5: Ask bureau to provide Method of Verification (MOV) documentation\n    STEP 6: Send same way as Letter 1 - certified mail\n    STEP 7: Wait 30 days for response\n    STEP 8: If still not removed, escalate to Letter 3\n    \n    TIMING: Send 30-45 days after Letter 1 response",
  "template_body": "[Your Name]\n[Your Address]\n[City, State ZIP]\n\n[Date]\n\n[Bureau Name]\n[Bureau Address]\n\nRe: REQUEST FOR METHOD OF VERIFICATION (MOV) - DISPUTED ACCOUNT\n\nConsumer Name: [Your Name]\nSSN: XXX-XX-[Last 4]\nBureau Reference #: [If provided in their response]\n\nDear [Bureau Name]:\n\nI received your response dated [date] regarding my dispute of [creditor name]. While you indicate the account was \"verified,\" I must respectfully dispute this verification.\n\nI am requesting detailed documentation of the Method of Verification (MOV) used to verify this account, including:\n\n1. Proof of actual contact with [creditor name]\n2. Documentation showing how accuracy was verified\n3. Copies of all communications with the creditor\n4. Details of the verification process followed\n5. Confirmation that current balance and status are accurate\n\nIf proper verification was not conducted, this item must be removed per FCRA requirements.\n\nPlease provide this documentation within 15 days.\n\nSincerely,\n\n[Your Signature]\n[Your Printed Name]"
}
```

### Exemplar C — Letter 26 (Stage 2, debt validation against a collector)

> Note: in the source library this letter has trailing strategy content that bled in from a parser artifact. The version below is trimmed to the actual letter — match that scope, not the bleed.

```json
{
  "number": 26,
  "stage": "Stage 2: Escalation & Collector Disputes",
  "category": "Debt Validation",
  "title": "Debt Validation Demand",
  "when_to_use": "• A debt collector has contacted you about a debt\n    • You receive a collection letter or call\n    • You want proof the debt is valid before paying\n    • Within 30 days of first contact from collector\n    • Creditor cannot prove debt belongs to you\n    • Account details don't match what collector claims",
  "why_it_works": "• FDCPA requires validation of debt within 30 days or communication stops\n    • Most collectors cannot provide proper validation\n    • Forces collector to prove debt is legitimate and theirs to collect\n    • If they can't prove it, they must stop trying to collect\n    • Creates legal protection if they violate this requirement\n    • Many debts get deleted because collector cannot validate",
  "how_to_use": "STEP 1: When you receive collection notice/call, respond immediately\n    STEP 2: Send this letter within 30 days of FIRST contact\n    STEP 3: Send certified mail - return receipt\n    STEP 4: Demand they prove 3 things: authority to collect, amount owed, that it's your debt\n    STEP 5: Tell them to verify before contacting you again\n    STEP 6: Save their response\n    STEP 7: If they contact you again without validation, they violated FDCPA\n    STEP 8: Most will either validate (properly) or stop contacting\n    \n    TIMING: CRITICAL - Must send within 30 days of first contact",
  "template_body": "[Your Name]\n[Your Address]\n[City, State ZIP]\n\n[Date]\n\n[Debt Collector Name]\n[Collector Address]\n[City, State ZIP]\n\nRe: FORMAL DEMAND FOR DEBT VALIDATION\n\nDear [Collector Name]:\n\nI received your notice dated [date] regarding an alleged debt of $[amount]. Pursuant to the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g, I am demanding that you provide verification of this alleged debt.\n\nI do not acknowledge this debt. Before any further collection activity, you MUST provide:\n\n1. Proof that you are authorized to collect this specific debt\n2. Original signed contract or agreement\n3. Itemized accounting showing the debt amount is accurate\n4. Proof that this debt legally belongs to me and not another person\n\nUntil you provide this verification, cease all collection activity. Do not contact me by phone. Do not report this to credit bureaus until validated.\n\nUnder FDCPA, you have 30 days to respond with proper verification.\n\nSincerely,\n\n[Your Signature]\n[Your Printed Name]\n\nCertified Mail - Return Receipt Requested"
}
```

**WRITE EVERY LETTER WITH THIS LEVEL OF DEPTH.** No shortcuts. No one-line `when_to_use`. No template body that's just a paragraph. Every letter is a complete artifact a non-lawyer can mail tomorrow.

---

## 4. Coverage Requirements

The library must include at minimum one letter for **every** scenario listed below. Many scenarios warrant multiple letters (e.g. round-1 vs round-2 follow-up, paid vs unpaid variants). Aim for ~100+ letters total, distributed across the three stages.

### Stage 1: Initial Disputes — Direct to Bureaus
Audience: credit bureaus (Equifax, Experian, TransUnion). Mechanism: FCRA §611 30-day investigation requirement.

- Basic dispute — inaccurate account
- Method of Verification (MOV) — round 1, round 2
- Late payments — 30-day, 60-day, 90-day, 120+ day variants
- Late payment after account brought current
- Charge-off — account never delinquent
- Charge-off — wrong original delinquency date
- Charge-off — account paid in full
- Collection account — paid
- Collection account — unpaid but disputed
- Collection less than 7 years old (still reportable)
- Collection more than 7 years old (must come off)
- Hard inquiries — unauthorized
- Hard inquiries — duplicate from same lender
- Soft inquiries appearing as hard
- Public records — bankruptcy, judgment, lien (each is a distinct letter)
- Bankruptcy — discharged, should not report individual debts
- Mixed file — someone else's data on your report
- Duplicate accounts — same creditor reporting twice
- Account sold — old creditor still reporting balance
- Account dates wrong — opened, last activity, first delinquency
- Balance reported wrong — too high
- Balance reported wrong — should be zero (paid)
- Payment history errors — late shown but paid on time
- Status incorrect — should be "paid" not "delinquent"
- Status incorrect — should be "closed by consumer" not "closed by creditor"
- Account type misreported — credit card vs revolving vs installment
- Credit limit wrong or missing (utilization impact)
- Authorized user — claim of authorized status when not authorized
- Authorized user — removed from account but still reporting
- Identity theft — fraudulent account dispute
- Identity theft with police report — FCRA §605B fast-track
- Identity theft with FTC report — block within 4 business days
- Medical debt — non-emergency, post-2022 reporting changes
- Medical debt under $500 (must come off per CFPB rules)
- Medical debt paid (must come off per recent rules)
- Re-aging dispute — debt shown with newer date than legally allowed
- Round 2 follow-up — bureau verified, you're not done
- Round 3 escalation — final bureau attempt before legal

### Stage 2: Escalation & Collector Disputes
Audience: original creditors and debt collectors. Mechanism: FDCPA §1692g (validation), FDCPA §1692c (cease & desist), goodwill, negotiation.

- Debt validation demand (FDCPA §1692g)
- Validation follow-up — collector responded but inadequately
- Cease & desist — all communication
- Cease & desist — phone calls only (still mail OK)
- Cease & desist — third-party harassment (work, family)
- Dispute debt ownership — collector is not original creditor
- Dispute amount — fees and interest improperly added
- Dispute account balance — too high
- Dispute accumulated interest/fees post-charge-off
- Pay-for-delete negotiation — open offer
- Pay-for-delete negotiation — counteroffer after collector responds
- Goodwill deletion request — paid lates, recent good history
- Goodwill — for medical hardship
- Goodwill — for natural disaster / declared emergency
- Goodwill — to original creditor after settlement
- Settlement offer — lump sum
- Settlement offer — payment plan
- Settlement offer — secured by deletion language
- FDCPA harassment notice — robocalls, threatening language
- FDCPA improper-third-party-disclosure notice
- FDCPA improper-time/place-contact notice
- Original creditor request — re-age impossible
- Original creditor request — bring account current after settlement
- Re-investigation demand — round 2 to original creditor
- Notice of intent to dispute with bureau if collector doesn't fix
- Notice of intent to record calls (state-dependent — letter notes which states)
- 1099-C cancellation-of-debt receipt — debt should not be re-collected
- Statute of limitations defense — collector cannot sue
- Statute of limitations defense — admonishment for time-barred suit threat

### Stage 3: Legal — Attorney-Level Demands
Audience: bureaus or creditors who have ignored prior letters. Mechanism: FCRA/FDCPA private right of action, statutory damages, escalation to regulators.

- FCRA violation demand — willful violation, statutory damages
- FCRA violation demand — failure to investigate
- FCRA violation demand — failure to follow MOV requirements
- FDCPA violation demand — improper collection
- FDCPA violation demand — false/misleading representations
- Pre-litigation demand letter — final warning before suit
- Notice of intent to file FCRA lawsuit
- Notice of intent to file FDCPA lawsuit
- Notice of intent to retain counsel
- CFPB complaint — escalation cover letter (CFPB itself accepts complaints; this is the parallel letter to the bureau/collector)
- State Attorney General complaint cover letter
- FTC complaint cover letter — identity theft, fraud, FCRA violation
- State-specific consumer protection complaint (variants per state)
- Demand for damages — actual + statutory + attorney's fees
- Settlement demand — pre-litigation, with deletion as condition
- Notice — denial of credit caused by inaccurate report (real damages claim)
- Notice — adverse action under FCRA §615 didn't include required disclosures
- Statute of limitations affirmative defense — for use if sued

This list is the floor, not the ceiling. Add letters for any scenario you identify that the library would need but the list above misses.

---

## 5. Placeholder Convention

Every place where the user must fill in their own data uses **`[Bracketed Words]`** with descriptive contents. Use these standard placeholders:

**Identity / contact:**
- `[Your Full Legal Name]`
- `[Your Address]`
- `[City, State ZIP]`
- `[Your Email Address]`
- `[Your Phone Number]`
- `[Your Signature]`
- `[Your Printed Name]`
- `[Date]`

**Personal identifiers (partial only — never full):**
- `XXX-XX-[Last 4 Digits of SSN]`
- `[MM/DD/YYYY]` for date of birth
- `Account Number: [Last 4 Digits]`

**Recipient — bureau:**
- `[Bureau Name - Equifax, Experian, or TransUnion]`
- `[Bureau Address]`
- `[Bureau Reference # - if provided in their response]`

**Recipient — creditor / collector:**
- `[Creditor Name]`
- `[Collector Name]`
- `[Creditor Address]` / `[Collector Address]`
- `[Original Creditor]` (when writing to a collector who bought the debt)

**Account / dispute specifics:**
- `[Account Number]`
- `[Account Type - Credit Card/Loan/Mortgage/Other]`
- `[Reported Balance]` or `[Amount]`
- `[Status Shown on Report]`
- `[Date Account Opened]`
- `[Date of First Delinquency]`
- `[Specific Issue / Reason for Dispute]`
- `[Month/Year of disputed event]`

**Cross-references:**
- `[Date of Prior Letter]`
- `[Date of Bureau Response]`
- `[Reference to Letter N or Round N]`

Never invent a placeholder format other than `[Brackets With Description]`. Never use `<angle brackets>` or `{curly braces}`. Never put the user's actual data in the template — every variable must be a placeholder.

---

## 6. Output Instructions

Return one valid JSON array. Top level is `[`, last character is `]`. No markdown code fences. No commentary before or after. No prose introduction. No "Here's the library:" preamble.

The output must parse with `JSON.parse()` on the first attempt without modification. If a value contains newlines, escape them as `\n`. If a value contains a double quote, escape it as `\"`.

Sort the array by `number` ascending. Numbers must be unique and sequential.

**Self-check before returning:**
- [ ] Output begins with `[` and ends with `]`
- [ ] Every object has all 8 required fields
- [ ] Every `stage` value is one of the three exact strings listed in §2
- [ ] Every `template_body` includes a sender block, date, recipient block, Re: line, salutation, body, signature
- [ ] Every `why_it_works` cites at least one federal statute by name and section
- [ ] Every `how_to_use` includes a `MAILING:` block and a `TIMING:` line
- [ ] No placeholder uses non-bracket syntax
- [ ] No letter is shorter than the shortest exemplar (Letter 26)
- [ ] At least one letter exists for every coverage item in §4

---

## 7. Quality Bar

These are non-negotiable. Letters that violate any of these will be rejected.

1. **Cite the law.** Every `why_it_works` names the statute (FCRA, FDCPA, etc.) and the section number (e.g. `FCRA §611`, `FDCPA §1692g`, `15 U.S.C. § 1692g`). Generic "the law requires…" is not sufficient.

2. **Explain the mechanism.** Don't just say a law applies — explain *what the law forces the recipient to do* and *why that helps the user*. Example: "FCRA §611 requires the bureau to investigate within 30 days. If they miss the window, the item must come off — verified or not. That deadline is the lever this letter pulls."

3. **Certified mail, every time.** Every `how_to_use` includes a `MAILING:` instruction telling the user to send certified mail with return receipt. Where the recipient address is standard (the three bureaus), include it. Where the recipient is creditor-specific, instruct the user to find it on their bill or report.

4. **Timing is explicit.** Every `how_to_use` includes a `TIMING:` line saying when to send (immediately, within 30 days of X, 30-45 days after Y).

5. **Letter sequencing.** Where a letter is part of an escalation chain, the `how_to_use` references the prior and next letter by number ("if not removed, send Letter 2"). Make the chain obvious.

6. **No legal advice tone.** The product is education, not legal counsel. Letters say "this is the legal mechanism and how to invoke it" — they do not say "you have a winning case" or "you will recover damages of $X."

7. **No defamation risk.** Letters can demand corrections and cite violations. They cannot accuse a specific person at a bureau or collector of fraud. Stick to the entity's obligations under the law.

8. **No personal data in templates.** Every personal field is a `[Bracketed Placeholder]`. The template_body is generic and reusable across all users.

9. **English, plain.** Eighth-grade reading level for the explanatory fields. Formal but readable for the template body. No legalese a non-lawyer can't parse.

10. **Self-contained.** A user with a high-school education and a copy of their credit report should be able to read one letter, fill in the placeholders, and mail it correctly.

---

End of brief. Return the JSON array now.
