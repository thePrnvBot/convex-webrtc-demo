import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  calls: defineTable({
    // We store candidates as JSON strings to avoid schema strictness issues
    // between different browsers (Chrome vs Safari props)
    offerCandidates: v.array(v.string()),
    answerCandidates: v.array(v.string()),

    offer: v.optional(v.object({
      type: v.string(),
      sdp: v.string(),
    })),

    answer: v.optional(v.object({
      type: v.string(),
      sdp: v.string(),
    })),
  }),
});