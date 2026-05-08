-- Phase 3.6: response tracking on letter_drafts.
--
-- Lets users log what came back from the bureau without waiting on the
-- Phase 4 document vault. response_received_at is the canonical signal
-- the dispute moved past 'sent' on the tracker board; outcome + notes
-- carry just enough to drive the next-step UI ('verified' / 'no_response'
-- → escalate to Letter 2 (MOV) or Letter 46 (Round 3)).

alter table public.letter_drafts
  add column if not exists response_received_at timestamptz,
  add column if not exists response_outcome     text
    check (response_outcome in ('deleted','verified','updated','no_response','other')),
  add column if not exists response_notes       text;

create index if not exists letter_drafts_response_received_at_idx
  on public.letter_drafts (response_received_at);
