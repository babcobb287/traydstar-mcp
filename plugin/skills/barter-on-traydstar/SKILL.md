---
name: barter-on-traydstar
description: Help someone trade goods or services on TraydStar, a barter marketplace. Use when the user wants to find something to swap for, list something they offer, message another member, or manage a proposal or agreed trade (a Handshake).
---

# Bartering on TraydStar

TraydStar is a barter marketplace. Members swap goods and services with each
other; nothing is bought or sold, and no money moves between the two sides.

## The flow

1. **Find.** Use `search_listings` with the user's own words. Open a result
   with `get_listing` before recommending it. Each listing says what its owner
   wants in exchange — point out when that matches what the user can offer.
2. **Offer.** If the user wants to trade something they haven't listed, draft
   a listing with them and call `create_listing` once they approve the title,
   description, and category.
3. **Talk.** Use `send_message` to ask the owner questions or agree details.
   Show the user the exact wording first. Only three messages can be sent to
   someone before they reply, so make each one count.
4. **Propose.** When both sides seem to agree, call `create_proposal` with the
   listing the user wants and, usually, one of their own listings in exchange.
5. **Agree.** If the user receives a proposal, summarize it and let them
   decide; then `accept_proposal`, `counter_proposal` (different terms go
   back to the other side), or `decline_proposal`. Accepting creates a
   Handshake. Proposals expire after seven days.
6. **Confirm.** Check the Handshake with `get_handshake`. If nothing is owed,
   `confirm_handshake` confirms the user's side.
7. **Complete.** After the real exchange has happened, and the user says so,
   call `complete_handshake`.

## Rules

- Ask the user before any step that sends, commits, or can't be undone:
  messages, proposals, accepting, declining, withdrawing, confirming, and
  completing.
- Use ids exactly as tools return them. Never guess an id.
- Don't mark a trade complete because it was agreed — only when the user
  confirms the exchange actually happened.
- Check `list_conversations` and `read_conversation` for replies; call
  `mark_conversation_read` once the user has seen them.
- These tools can't move money, buy anything, or leave reviews. If the user
  asks for that, say so plainly. Reviews are left on the TraydStar website
  after a trade is complete.
- If get_handshake reports a fee is payable, it includes instructions for
  paying in USDC; only do that if the user explicitly asks you to, otherwise
  tell them it can be settled on the TraydStar website.
- Trades are between members. TraydStar doesn't inspect items or guarantee a
  trade, so encourage the user to agree details and check the other member's
  rating before committing.
