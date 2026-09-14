import { describe, it, expect } from "vitest";
import { matchIntent, RESIDENT_INTENTS, MANAGER_INTENTS } from "../chatbotKnowledge";

describe("chatbot intent matching (resident)", () => {
  it("matches an incident report request regardless of accents/case", () => {
    const intent = matchIntent("Je veux SIGNALER une fuite d'eau", RESIDENT_INTENTS);
    expect(intent.route).toBe("/signaler");
  });

  it("matches a wallet/balance question", () => {
    const intent = matchIntent("c'est quoi mon solde sur ma carte ?", RESIDENT_INTENTS);
    expect(intent.route).toBe("/ma-carte");
  });

  it("matches a restaurant question", () => {
    const intent = matchIntent("qu'est ce qu'il y a au menu ce midi", RESIDENT_INTENTS);
    expect(intent.route).toBe("/restaurant");
  });

  it("returns null for unrelated gibberish", () => {
    const intent = matchIntent("xyzabc123 zzz", RESIDENT_INTENTS);
    expect(intent).toBeNull();
  });

  it("matches accented keywords even without accents in the input", () => {
    // "reserver" (no accent) must still match the "reserver" keyword variants used across intents
    const intent = matchIntent("je veux reserver un rendez vous", RESIDENT_INTENTS);
    expect(intent.route).toBe("/administration");
  });
});

describe("chatbot intent matching (manager)", () => {
  it("matches an incidents list request", () => {
    const intent = matchIntent("montre moi les incidents en cours", MANAGER_INTENTS);
    expect(intent.route).toBe("/manager/incidents");
  });

  it("matches a lease verification / users directory request", () => {
    const intent = matchIntent("je dois verifier un bail", MANAGER_INTENTS);
    expect(intent.route).toBe("/manager/utilisateurs");
  });

  it("picks the intent with the strongest keyword overlap", () => {
    const intent = matchIntent("planning des interventions techniques", MANAGER_INTENTS);
    expect(intent.route).toBe("/manager/planning");
  });
});
