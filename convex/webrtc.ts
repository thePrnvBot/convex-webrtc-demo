import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const createCall = mutation({
  handler: async (ctx) => {
    const callId = await ctx.db.insert("calls", {
      offerCandidates: [],
      answerCandidates: [],
    });
    return callId;
  },
});

export const getCall = query({
  args: { id: v.union(v.id("calls"), v.null()) },
  handler: async (ctx, args) => {
    if (!args.id) return null;
    return await ctx.db.get(args.id);
  },
});

export const addOffer = mutation({
  args: { id: v.id("calls"), offer: v.object({ type: v.string(), sdp: v.string() }) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { offer: args.offer });
  },
});

export const addAnswer = mutation({
  args: { id: v.id("calls"), answer: v.object({ type: v.string(), sdp: v.string() }) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { answer: args.answer });
  },
});

export const addOfferCandidate = mutation({
  args: { id: v.id("calls"), candidate: v.string() },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.id);
    if (call) {
      await ctx.db.patch(args.id, {
        offerCandidates: [...call.offerCandidates, args.candidate]
      });
    }
  },
});

export const addAnswerCandidate = mutation({
  args: { id: v.id("calls"), candidate: v.string() },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.id);
    if (call) {
      await ctx.db.patch(args.id, {
        answerCandidates: [...call.answerCandidates, args.candidate]
      });
    }
  },
});