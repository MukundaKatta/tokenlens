import { describe, it, expect } from "vitest";
import { Tokenlens } from "../src/core.js";
describe("Tokenlens", () => {
  it("init", () => { expect(new Tokenlens().getStats().ops).toBe(0); });
  it("op", async () => { const c = new Tokenlens(); await c.process(); expect(c.getStats().ops).toBe(1); });
  it("reset", async () => { const c = new Tokenlens(); await c.process(); c.reset(); expect(c.getStats().ops).toBe(0); });
});
