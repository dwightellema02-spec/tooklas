/**
 * Phase 9: Remediation Selector
 *
 * Selects existing, authorized curriculum assets (lessons, practice sets, or AI tutor)
 * tailored to a student's detected learning gap or difficulty level.
 */

import { dbService } from "../db";
import type { QuestionDifficulty, RecommendedActivityType } from "./adaptive-types";

export interface SelectedRemediationTarget {
  activityType: RecommendedActivityType;
  activityId?: string | null;
  activityTitle: string;
  practiceSetId?: string | null;
  lessonId?: string | null;
  difficulty?: QuestionDifficulty;
  details: string;
}

export class RemediationSelector {
  /**
   * Find approved practice set or lesson matching the target skill and difficulty
   */
  static async selectRemediationActivity(params: {
    skillId: string;
    targetDifficulty?: QuestionDifficulty;
    prerequisiteSkillId?: string;
    activityType: RecommendedActivityType;
  }): Promise<SelectedRemediationTarget> {
    const { skillId, targetDifficulty = "EASY", prerequisiteSkillId, activityType } = params;

    // 1. If reviewing a prerequisite
    if (activityType === "PREREQUISITE_LESSON" && prerequisiteSkillId) {
      const prereqSkill = await dbService.getSkillById(prerequisiteSkillId);
      const prereqLesson = prereqSkill?.lessons?.[0]?.lesson;

      if (prereqLesson && prereqLesson.status === "PUBLISHED") {
        return {
          activityType: "PREREQUISITE_LESSON",
          activityId: prereqLesson.id,
          activityTitle: `Review Prerequisite: ${prereqLesson.title}`,
          lessonId: prereqLesson.id,
          details: `Revisit foundational concepts in "${prereqLesson.title}" to strengthen core mathematical principles.`,
        };
      }
    }

    // 2. If lesson review is needed
    if (activityType === "LESSON_REVIEW") {
      const skill = await dbService.getSkillById(skillId);
      const lesson = skill?.lessons?.[0]?.lesson;

      if (lesson && lesson.status === "PUBLISHED") {
        return {
          activityType: "LESSON_REVIEW",
          activityId: lesson.id,
          activityTitle: `Review Lesson: ${lesson.title}`,
          lessonId: lesson.id,
          details: `Walk through the worked examples and conceptual explanations in "${lesson.title}".`,
        };
      }
    }

    // 3. If practice set is recommended (EASIER, SAME, or HARDER)
    const practiceSets: any[] = await dbService.getPracticeSets({ skillId });
    // Choose the published set whose questions are closest to the difficulty the decision asked for (easy, medium or
    // hard). Before, the first published set was always taken, so a struggling student could be sent the challenge set.
    const rankOf = (d: string) => (d === "HARD" ? 3 : d === "MEDIUM" ? 2 : 1);
    const wanted = rankOf(targetDifficulty);
    const scored = practiceSets
      .filter((ps: any) => ps.status === "PUBLISHED" && (!ps.isDiagnostic || targetDifficulty === "EASY"))
      .map((ps: any) => {
        const qs: any[] = Array.isArray(ps.questions) ? ps.questions : [];
        const ranks = qs.map((q) => rankOf(String(q.question?.difficulty || "MEDIUM")));
        return { ps, level: ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null };
      })
      .filter((x) => x.level !== null) as Array<{ ps: any; level: number }>;
    scored.sort((a, b) => Math.abs(a.level - wanted) - Math.abs(b.level - wanted) || (wanted >= 2 ? b.level - a.level : a.level - b.level));
    const candidateSet =
      scored[0]?.ps ||
      practiceSets.find((ps: any) => ps.status === "PUBLISHED" && (!ps.isDiagnostic || targetDifficulty === "EASY")) ||
      practiceSets[0];

    if (candidateSet) {
      const diffLabel = targetDifficulty.toLowerCase();
      return {
        activityType: "PRACTICE_SET",
        activityId: candidateSet.id,
        activityTitle: `${candidateSet.title} (${diffLabel} practice)`,
        practiceSetId: candidateSet.id,
        difficulty: targetDifficulty,
        details: `Practice formative questions calibrated for ${diffLabel} difficulty to reinforce understanding.`,
      };
    }

    // 4. Default: AI Tutor session or lesson exploration
    const skill = await dbService.getSkillById(skillId);
    return {
      activityType: "AI_TUTOR_SESSION",
      activityId: skillId,
      activityTitle: `Socratic Help: ${skill?.title || "Concept Reinforcement"}`,
      details: "Work one-on-one with the Tuklas AI Tutor for interactive step-by-step guidance.",
    };
  }
}
