/**
 * Adds the illustrations (IMAGE blocks) to the Term 1 lessons that already exist in the database, draft or
 * published, without touching anything a teacher wrote.
 *
 *   npx tsx scripts/seed-lesson-figures.ts          # dry run, rolls back
 *   npx tsx scripts/seed-lesson-figures.ts --apply  # writes
 *
 * Each figure is placed right after the block it is anchored to (see prisma/g7-q1-figures.ts). Existing
 * blocks keep their ids, so student progress on checkpoints is not lost. Their sequence numbers and the
 * "3." style prefix of their titles are renumbered to match the new order. Figures that are already there
 * are updated (alt text and caption), never duplicated. Nothing is deleted.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Q1_DRAFT_LESSONS } from "../prisma/g7-q1-lessons.ts";

const apply = process.argv.includes("--apply");
class DryRunRollback extends Error {}

const stripNumber = (t: string | null) => (t ?? "").replace(/^\d+\.\s+/, "");

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const prisma = new PrismaClient();
  console.log(apply ? "== APPLY: changes will be committed ==" : "== DRY RUN: changes will be rolled back ==");
  const counts = { lessons: 0, added: 0, updated: 0, renumbered: 0 };
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const l of Q1_DRAFT_LESSONS) {
          const figures = l.blocks.filter((b) => b.id); // blocks added after the first release: figures and explorers
          if (!figures.length) continue;
          const lesson = await tx.lesson.findUnique({ where: { id: l.id } });
          if (!lesson) {
            console.log(`  - ${l.id}: lesson not in this database, skipped`);
            continue;
          }
          const existing = await tx.lessonContentBlock.findMany({ where: { lessonId: l.id }, orderBy: { sequenceOrder: "asc" } });
          const order = existing.map((b) => ({ id: b.id, title: b.title, type: b.type as string }));
          let changed = false;

          for (const fig of figures) {
            const meta = JSON.stringify(fig.metadata);
            const bare = stripNumber(fig.title);
            const have = existing.find((b) => b.id === fig.id);
            if (have) {
              if (have.content !== fig.content || have.metadata !== meta || stripNumber(have.title) !== bare) {
                await tx.lessonContentBlock.update({ where: { id: have.id }, data: { content: fig.content, metadata: meta, title: have.title?.replace(stripNumber(have.title), bare) ?? bare } });
                counts.updated++;
              }
              continue;
            }
            // Anchor: the generated block just before this figure that is not itself a figure.
            const gi = l.blocks.findIndex((b) => b.id === fig.id);
            let prev = gi - 1;
            while (prev >= 0 && l.blocks[prev].id) prev--;
            const anchorTitle = prev >= 0 ? stripNumber(l.blocks[prev].title) : "";
            let at = order.findIndex((b) => stripNumber(b.title) === anchorTitle);
            if (at < 0) throw new Error(`${l.id}: anchor "${anchorTitle}" for figure ${fig.id} not found in the stored lesson`);
            // After any figures already placed behind that anchor.
            while (order[at + 1] && /_(fig|exp)_/.test(order[at + 1].id)) at++;
            await tx.lessonContentBlock.create({
              data: { id: fig.id!, lessonId: l.id, type: fig.type as "IMAGE" | "INTERACTIVE", sequenceOrder: 9999, title: fig.title, content: fig.content, metadata: meta },
            });
            order.splice(at + 1, 0, { id: fig.id!, title: fig.title, type: fig.type });
            counts.added++;
            changed = true;
          }

          if (changed) {
            const rows = await tx.lessonContentBlock.findMany({ where: { lessonId: l.id } });
            const byId = new Map(rows.map((r) => [r.id, r]));
            let n = 0;
            for (const o of order) {
              n++;
              const r = byId.get(o.id);
              if (!r) continue;
              const numbered = /^\d+\.\s/.test(r.title ?? "") || /_(fig|exp)_/.test(r.id);
              const title = numbered ? `${n}. ${stripNumber(r.title)}` : r.title;
              if (r.sequenceOrder !== n || title !== r.title) {
                await tx.lessonContentBlock.update({ where: { id: r.id }, data: { sequenceOrder: n, title } });
                counts.renumbered++;
              }
            }
            counts.lessons++;
            console.log(`  + ${l.id}: figures placed (${figures.length}), ${order.length} blocks in order`);
          }
        }
        console.log(`\n${apply ? "Written" : "Would write"}: ${counts.added} figures added, ${counts.updated} updated, ${counts.renumbered} blocks renumbered in ${counts.lessons} lessons`);
        if (!apply) throw new DryRunRollback();
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
    console.log("Changes committed.");
  } catch (e) {
    if (e instanceof DryRunRollback) console.log("Dry run only: nothing was written. Re-run with --apply.");
    else throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
