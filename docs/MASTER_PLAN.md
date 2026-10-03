# TUKLAS AI

## MASTER PRODUCT, ARCHITECTURE, AI LEARNING & PRODUCTION ROADMAP

**Document Status:** Master Source of Truth
**Current Verified Phase:** Phase 21
**Next Phase:** Phase 22
**Primary Goal:** Build Tuklas AI into a real, production-ready adaptive learning platform where students and teachers can use the system reliably, and where the AI functions as a genuine learning companion rather than a generic chatbot.

---

# 1. PRODUCT VISION

Tuklas AI is an interactive, adaptive, problem-based learning platform initially focused on **Grade 7 Mathematics aligned with the DepEd MATATAG Curriculum**.

The fundamental learning loop is:

```text
LEARN
   ↓
THINK
   ↓
ANSWER
   ↓
RECEIVE FEEDBACK
   ↓
UNDERSTAND MISTAKE
   ↓
PRACTICE
   ↓
ADAPT
   ↓
MASTER
   ↓
PROGRESS
```

The ultimate objective is NOT simply:

> "Build an AI chatbot."

The objective is:

> **Build an AI-powered learning system that understands what the student is learning, understands what the student is doing, identifies what the student is struggling with, and determines what educational intervention should happen next.**

---

# 2. THE FINAL PRODUCT EXPERIENCE

## 2.1 Student

A student should be able to:

```text
REGISTER
   ↓
LOGIN
   ↓
SEE LEARNING PATH
   ↓
OPEN AVAILABLE LESSON
   ↓
LEARN FROM TEACHER CONTENT
   ↓
INTERACT WITH CONTENT
   ↓
ANSWER QUESTIONS
   ↓
MAKE MISTAKES
   ↓
ASK AI FOR HELP
   ↓
USE TEXT OR VOICE
   ↓
RECEIVE ADAPTIVE SOCRATIC GUIDANCE
   ↓
PRACTICE
   ↓
ANALYZE MISTAKES
   ↓
RECEIVE TARGETED REMEDIATION
   ↓
RETRY
   ↓
DEMONSTRATE MASTERY
   ↓
UNLOCK NEXT LEARNING STEP
```

The student should never need to understand the internal AI architecture.

Everything should feel like one coherent learning environment.

---

# 3. THE TUKLAS AI IDENTITY

The AI should behave as a:

**Learning Companion + Tutor + Coach**

It should NOT behave primarily as:

* a generic chatbot
* an answer generator
* a search engine
* a homework answer machine
* a repetitive scripted bot

The AI should continuously ask internally:

```text
What is the student trying to do?

What concept are they learning?

What did they just say?

What did they previously say?

What mistake did they make?

What misconception does that reveal?

What have they already mastered?

What prerequisite might be missing?

What explanation has already failed?

What should I ask or show next?
```

The central question becomes:

> **"What does this student need next?"**

rather than:

> **"What answer should I return?"**

---

# 4. CORE AI BEHAVIOR

The AI must communicate naturally.

Example:

Student:

> "I don't understand."

AI:

> Diagnose the likely point of confusion and ask a focused question.

Student:

> "I think the answer is -10."

AI:

> Analyze the reasoning, not merely say "wrong."

Student:

> "Why did we move left?"

AI:

> Explain the number-line concept specifically related to the current lesson.

Student:

> "Can you give me another example?"

AI:

> Generate a lesson-aligned example.

Student:

> "I still don't get it."

AI:

> Change explanation strategy rather than repeating the previous explanation.

Student:

> "Just give me the answer."

AI:

> Do not immediately reveal the answer. Increase scaffolding.

The AI must avoid repeating the same generic response.

---

# 5. SOCRATIC TUTORING MODEL

The preferred intervention ladder is:

```text
HINT
 ↓
GUIDING QUESTION
 ↓
STRONGER HINT
 ↓
CONCEPT EXPLANATION
 ↓
PARTIAL SOLUTION
 ↓
WORKED EXAMPLE
 ↓
FULL EXPLANATION
```

However, this must NOT be a rigid script.

The AI should choose the intervention based on evidence.

For example:

### Student demonstrates understanding

Reduce scaffolding.

### Student makes a small sign error

Give targeted correction.

### Student repeatedly makes the same misconception

Change strategy and provide prerequisite remediation.

### Student says "I don't know"

Reduce cognitive load and provide one manageable starting point.

### Student repeatedly succeeds

Increase difficulty.

### Student is close to mastery

Provide transfer/application problems rather than repeating basic exercises.

---

# 6. AI LESSON AWARENESS

The AI must be grounded in the current published lesson.

The context hierarchy is:

```text
1. CURRENT PUBLISHED LESSON
2. CURRENT QUESTION / PRACTICE
3. CURRENT SKILL
4. TEACHER-AUTHORED MATERIALS
5. APPROVED SUPPORTING RESOURCES
6. STUDENT LEARNING EVIDENCE
7. CURRICULUM METADATA
8. GENERAL KNOWLEDGE
```

The AI must distinguish between:

> "Your lesson explains..."

and:

> "In general, mathematics..."

The AI must NEVER claim to have read or watched content that it did not actually receive.

---

# 7. TEACHER CONTENT → AI KNOWLEDGE PIPELINE

Long-term architecture:

```text
TEACHER
   ↓
CREATE LESSON
   ↓
ADD CONTENT
   ├── Text
   ├── Examples
   ├── Questions
   ├── Practice
   ├── Teacher Notes
   ├── PDF
   ├── DOCX
   ├── LAS
   ├── YouTube
   └── Other Approved Resources
   ↓
PUBLISH
   ↓
CONTENT INGESTION
   ↓
NORMALIZATION
   ↓
CONTENT INDEX
   ↓
RELEVANT CONTENT RETRIEVAL
   ↓
AI CONTEXT BUILDER
   ↓
AI LEARNING COMPANION
```

The teacher should NOT have to manually create an AI prompt for every lesson.

Teacher publishes educational content.

Tuklas makes the relevant content available to the AI.

---

# 8. DOCUMENT INTELLIGENCE

Current Phase 21 status:

**NOT IMPLEMENTED**

Current upload/storage capability must NOT be mistaken for document intelligence.

The required future pipeline is:

```text
UPLOAD
 ↓
VALIDATE
 ↓
STORE
 ↓
EXTRACT TEXT
 ↓
NORMALIZE
 ↓
CHUNK
 ↓
INDEX
 ↓
RETRIEVE
 ↓
AI CONTEXT
```

Supported targets:

* PDF
* DOCX
* text-based documents
* scanned PDF where OCR is appropriate

Requirements:

* file validation
* authorization
* size limits
* malicious-file protection
* privacy protection
* extraction failure handling
* prompt-injection handling
* source attribution
* lesson association
* retrieval quality testing

The AI must never say:

> "I read your PDF."

unless the PDF was actually successfully ingested.

---

# 9. YOUTUBE / VIDEO INTELLIGENCE

Tuklas must NOT:

* scrape YouTube illegally
* download/rehost videos
* pretend the AI watched a video
* fabricate video-specific claims

The AI may use:

* actual authorized transcript
* teacher-provided transcript
* teacher notes
* lesson content
* metadata
* approved textual resources

If no textual representation is available:

> The AI must honestly state that it does not have the video's content available.

---

# 10. AI QUESTION GENERATION

The AI should generate questions based on:

```text
LESSON
SKILL
COMPETENCY
OBJECTIVE
CURRENT DIFFICULTY
STUDENT PERFORMANCE
MISTAKES
MASTERY
PREREQUISITES
```

Example:

If the student repeatedly makes integer sign errors:

```text
DO NOT:
Generate unrelated geometry questions.

DO:
Generate targeted integer-sign practice.
```

Generated questions must be validated.

---

# 11. QUESTION VALIDATION

AI must never be the sole authority for mathematical correctness.

Every generated question should be checked for:

* mathematical correctness
* answer correctness
* explanation correctness
* lesson alignment
* skill alignment
* grade appropriateness
* difficulty
* ambiguity
* duplicate detection
* answer leakage

Where possible:

```text
AI GENERATION
     ↓
DETERMINISTIC VALIDATOR
     ↓
QUALITY CHECK
     ↓
STUDENT
```

---

# 12. MISTAKE ENGINE

The system should not simply record:

```text
WRONG
```

It should determine:

```text
WHAT DID THE STUDENT DO?
        ↓
WHAT WAS INCORRECT?
        ↓
WHY WAS IT INCORRECT?
        ↓
WHAT MISCONCEPTION DOES THIS SUGGEST?
        ↓
WHAT SHOULD HAPPEN NEXT?
```

Possible categories:

* sign error
* calculation error
* concept misunderstanding
* procedural error
* prerequisite gap
* reading/comprehension issue
* careless/inconsistent response
* repeated misconception

Mistake evidence must feed the AI.

---

# 13. ADAPTIVE LEARNING ENGINE

The adaptive engine should determine:

```text
EASIER
NORMAL
HARDER
REMEDIATE
RETRY
REVIEW
ADVANCE
```

based on actual evidence.

Inputs include:

* accuracy
* recent attempts
* mistakes
* mastery
* prerequisite status
* difficulty
* consistency
* practice history
* lesson completion
* teacher assignment

The system should not adapt merely because a student clicked a button.

---

# 14. MASTERY ENGINE

The mastery model uses:

```text
NOT_STARTED
LEARNING
DEVELOPING
PROFICIENT
MASTERED
```

Mastery should be evidence-based.

Evidence may include:

* accuracy
* recent performance
* consistency
* application
* difficulty diversity
* prerequisite mastery
* practice history

Mastery must not be awarded solely because:

> "The student finished the lesson."

---

# 15. STUDENT LEARNING PROFILE

Long-term student profile:

```text
MASTERED SKILLS
DEVELOPING SKILLS
RECURRING MISTAKES
PREREQUISITE GAPS
PRACTICE HISTORY
LEARNING CONSISTENCY
OBSERVED EXPLANATION PREFERENCES
CONFIDENCE INDICATORS
```

Do not collect unnecessary sensitive information.

The profile exists to improve instruction, not to label students.

---

# 16. AI CONVERSATION MEMORY

The AI must maintain useful conversation continuity.

It should remember relevant context such as:

```text
CURRENT LESSON
CURRENT QUESTION
STUDENT'S LAST ANSWER
PREVIOUS MISTAKE
PREVIOUS EXPLANATION
STUDENT'S FOLLOW-UP
CURRENT MISCONCEPTION
CURRENT TUTORING STATE
```

Example:

Student:

> "I think -7 is correct."

AI:

> analyzes.

Student:

> "Why?"

The AI must understand what "why" refers to.

It should NOT reset to:

> "Let's learn about integers!"

---

# 17. AI TUTOR STATE

The AI should maintain a tutoring state conceptually similar to:

```text
INTRODUCING
EXPLAINING
CHECKING
DIAGNOSING
SCAFFOLDING
REMEDIATING
PRACTICING
CHALLENGING
REFLECTING
MASTERING
```

The state should influence the next response.

This is one of the most important areas for preventing repetitive chatbot behavior.

---

# 18. VOICE AI

Voice and text must use the same central tutoring brain.

Architecture:

```text
STUDENT VOICE
    ↓
Speech Recognition
    ↓
Transcript
    ↓
CENTRAL AI TUTOR
    ↓
Tutor Response
    ↓
Text
    ↓
Speech Synthesis
    ↓
STUDENT HEARS RESPONSE
```

Voice must preserve:

* conversation context
* lesson context
* mistake context
* mastery context
* Socratic behavior

Voice must NOT become a separate AI system.

---

# 19. VOICE SAFETY

The system must:

* request microphone permission properly
* handle denied permissions
* stop listening when appropriate
* stop listening when tab becomes hidden
* support interruption/barge-in
* prevent speech overlap
* sanitize sensitive tokens
* avoid storing raw audio unnecessarily
* provide keyboard fallback
* support browser compatibility handling

Current status:

**Automated voice tests PASS**

but:

**Physical browser microphone validation remains required.**

---

# 20. TEACHER PLATFORM

Teachers should be able to:

```text
CREATE ACCOUNT
 ↓
CREATE CLASS
 ↓
ENROLL STUDENTS
 ↓
CREATE CURRICULUM CONTENT
 ↓
CREATE UNIT
 ↓
CREATE LESSON
 ↓
ADD MATERIALS
 ↓
ADD QUESTIONS
 ↓
ADD VIDEOS
 ↓
PUBLISH
 ↓
STUDENTS ACCESS
 ↓
MONITOR LEARNING
```

---

# 21. TEACHER ANALYTICS

The teacher dashboard should eventually answer:

* Which students are struggling?
* Which skills are weak?
* Which mistakes are common?
* Which lessons have low completion?
* Which concepts require intervention?
* Which students improved?
* Which students need teacher attention?

Analytics must be based on actual evidence.

---

# 22. TEACHER AI CONTROLS

Future teacher controls may include:

* allowed difficulty range
* hint behavior
* direct-answer policy
* practice generation
* approved resources
* AI availability
* classroom AI settings

Teacher configuration must NOT bypass:

* authentication
* authorization
* student privacy
* content safety
* mathematical validation
* core educational integrity

---

# 23. SECURITY

Production security is mandatory.

Requirements include:

* secure authentication
* password hashing
* secure sessions
* RBAC
* student isolation
* teacher isolation
* classroom authorization
* lesson authorization
* draft/published separation
* IDOR protection
* rate limiting
* input validation
* secret protection
* API protection
* file validation
* prompt-injection defense
* sensitive-data minimization

---

# 24. DATABASE / PERSISTENCE

Production learning data must be persisted in PostgreSQL.

Important entities include:

```text
User
StudentProgress
Lesson
LessonContentBlock
LessonResource
LessonSkill
Skill
SkillPrerequisite
LessonSession
CheckpointAttempt
Question
PracticeSet
PracticeSession
QuestionAttempt
AITutorConversation
AITutorMessage
MistakeAnalysis
AdaptiveRecommendation
SkillMastery
SkillMasteryHistory
Classroom
ClassroomEnrollment
Assignment
Assessment
```

The database must be the authoritative production source.

In-memory storage must never silently replace production persistence.

---

# 25. CURRICULUM

Initial target:

```text
DepEd MATATAG
Grade 7 Mathematics
Term 1
```

Architecture must eventually support:

```text
Grade 7
Grade 8
Grade 9
Grade 10

Term 1
Term 2
Term 3
Term 4 where applicable

Mathematics
English
Science
Future subjects
```

Do not expand scope before the core architecture is stable.

---

# 26. LEARNING PATH

The learning path should use:

```text
CURRICULUM
   +
PREREQUISITES
   +
MASTERY
   +
MISTAKES
   +
RECENT PERFORMANCE
   +
TEACHER ASSIGNMENTS
```

to determine:

> **What should the student learn next?**

Example:

```text
CURRENT SKILL
     ↓
DEVELOPING
     ↓
PREREQUISITE GAP FOUND
     ↓
REMEDIATION
     ↓
RETRY CURRENT SKILL
```

or:

```text
CURRENT SKILL
     ↓
MASTERED
     ↓
PREREQUISITES SATISFIED
     ↓
NEXT SKILL
```

---

# 27. CURRENT PHASE HISTORY

The existing project has already implemented major foundational phases.

## Phase 1 — Foundation

Project structure, UI foundation, accessibility, branding.

## Phase 2 — Database & Authentication

PostgreSQL, Prisma, authentication, sessions, RBAC.

## Phase 3 — Curriculum & Teacher Studio

Curriculum hierarchy, authoring, resources, content blocks, publishing.

## Phase 4 — Learning Path

Prerequisites, sequencing, access gating, next activity.

## Phase 5 — Interactive Lessons

Interactive content, mathematics rendering, number-line tools, checkpoints, examples, video support.

## Phase 6 — Questions & Practice

Question types, validation, attempts, practice sets, teacher question bank.

## Phase 7 — AI Tutor

Gemini provider, local provider, context builder, Socratic tutoring, persistent conversations.

## Phase 8 — Mistake Analyzer

Error classification, misconception detection, evidence linkage.

## Phase 9 — Adaptive Learning

Difficulty adjustment, remediation, recommendations.

## Phase 10 — Mastery

Five-stage mastery engine and longitudinal evidence.

Additional production, security, pilot, voice and AI-learning phases have subsequently been completed through Phase 21.

---

# 28. CURRENT PHASE 21 REALITY

Reported automated verification:

```text
325 / 325 assertions PASS
```

Verified areas include:

* AI lesson awareness
* AI question generation
* AI conversational behavior
* Socratic behavior
* mistake-aware tutoring
* adaptive tutoring
* mastery-aware tutoring
* teacher material intelligence
* YouTube/Mathisipan integrity
* conversation continuity
* voice/text context consistency
* student isolation
* teacher isolation
* fallback behavior
* PostgreSQL persistence
* question correctness
* TypeScript
* build
* regression tests

However, Phase 21 explicitly identifies real gaps.

---

# 29. KNOWN GAPS THAT MUST NOT BE MARKED COMPLETE

## Gap A — PDF/DOCX intelligence

Current:

```text
UPLOAD
STORE
METADATA
```

but not complete:

```text
EXTRACT
NORMALIZE
CHUNK
INDEX
RETRIEVE
```

Therefore:

**DOCUMENT INTELLIGENCE = NOT COMPLETE**

---

## Gap B — Physical voice validation

Automated tests cannot prove that:

* Chrome microphone works on a real laptop
* Edge works
* mobile works
* Safari works where supported
* noisy environments work
* permissions work correctly
* speech recognition behaves correctly
* speech synthesis behaves correctly

Therefore:

**REAL-WORLD VOICE = NOT YET FULLY VERIFIED**

---

## Gap C — Gemini dependency

If Gemini is unavailable:

```text
Gemini
  ↓
LocalTutorEngine
```

The fallback is useful, but the production AI quality of the local engine must not be treated as equivalent to a modern conversational model.

---

# 30. PHASE 22 — REAL-WORLD END-TO-END VALIDATION

Goal:

Validate the entire product using actual browser workflows.

### Student

```text
Register
→ Login
→ Learning Path
→ Lesson
→ Content
→ Question
→ Mistake
→ AI Text
→ AI Voice
→ Practice
→ Adaptation
→ Mastery
```

### Teacher

```text
Register
→ Create Class
→ Enroll Student
→ Create Unit
→ Create Lesson
→ Add Material
→ Publish
→ Student Access
→ Monitor
```

### Exit criteria

Do not rely solely on automated tests.

Require real-browser evidence.

---

# 31. PHASE 23 — DOCUMENT INTELLIGENCE

Build:

```text
PDF/DOCX
 ↓
SECURE UPLOAD
 ↓
EXTRACTION
 ↓
NORMALIZATION
 ↓
CHUNKING
 ↓
INDEXING
 ↓
LESSON ASSOCIATION
 ↓
RETRIEVAL
 ↓
AI CONTEXT
```

Test:

* normal PDF
* text PDF
* DOCX
* malformed files
* oversized files
* scanned PDF
* malicious content
* teacher authorization
* student isolation
* prompt injection inside documents
* retrieval accuracy

---

# 32. PHASE 24 — CONTENT-GROUNDED AI

Make the AI reliably retrieve the right educational material.

The AI should know:

```text
Which lesson?
Which section?
Which example?
Which teacher material?
Which resource?
Which skill?
Which objective?
```

The response should be grounded in retrieved content.

Add source-awareness such as:

```text
Lesson content
Teacher material
Example
Practice
Resource
```

without fabricating sources.

---

# 33. PHASE 25 — ADVANCED AI LEARNING COMPANION

Deepen:

* natural conversation
* misconception diagnosis
* explanation adaptation
* multi-turn reasoning
* prerequisite discovery
* learning-strategy adaptation
* reflection
* confidence-aware tutoring where appropriate
* lesson-specific dialogue
* mastery-aware dialogue

The goal is to eliminate:

> same question → same response

and replace it with:

```text
STUDENT MESSAGE
      ↓
INTERPRET INTENT
      ↓
UNDERSTAND LEARNING STATE
      ↓
CHECK HISTORY
      ↓
CHECK MISTAKES
      ↓
CHECK MASTERY
      ↓
CHOOSE INTERVENTION
      ↓
GENERATE RESPONSE
      ↓
UPDATE TUTORING STATE
```

---

# 34. PHASE 26 — AI-GENERATED PRACTICE

Teacher publishes a lesson.

Tuklas understands:

* objective
* skill
* content
* examples
* difficulty

Then generates:

* guided questions
* basic practice
* remediation
* challenge questions
* review questions
* transfer questions

Every generated item must pass validation.

---

# 35. PHASE 27 — PERSONALIZED LEARNING PATH

Build a dynamic learning path using:

```text
Curriculum
+
Prerequisites
+
Mastery
+
Mistakes
+
Recent performance
+
Teacher assignments
```

The system should determine:

> What should this student do next?

---

# 36. PHASE 28 — TEACHER ANALYTICS

Expand teacher analytics into evidence-based intervention.

Example:

```text
CLASS
 ↓
SKILL PERFORMANCE
 ↓
COMMON MISCONCEPTIONS
 ↓
STUDENT GROUPS
 ↓
RECOMMENDED INTERVENTIONS
```

The teacher should be able to identify students who need help without manually inspecting every attempt.

---

# 37. PHASE 29 — PRODUCTION RELIABILITY

Test:

* server restart
* database restart
* network interruption
* Gemini unavailable
* slow API
* duplicate requests
* concurrent users
* session expiration
* stale sessions
* browser refresh
* mobile connection
* classroom-scale usage

The system should fail gracefully.

---

# 38. PHASE 30 — ACCESSIBILITY & DEVICE COMPATIBILITY

Validate:

* desktop
* laptop
* tablet
* mobile
* keyboard navigation
* screen readers where applicable
* readable mathematics
* voice fallback
* touch interaction
* responsive layout
* slow network conditions

---

# 39. PHASE 31 — SECURITY AUDIT

Perform adversarial testing:

```text
Authentication
Authorization
IDOR
RBAC
Session attacks
Prompt injection
File attacks
Resource authorization
Draft leakage
Student isolation
Teacher isolation
Rate limiting
Secret leakage
API abuse
```

---

# 40. PHASE 32 — CLASSROOM PILOT

Conduct a controlled pilot with real:

* students
* teachers
* devices
* browsers
* classroom network
* microphones

Measure:

* completion
* usability
* AI usefulness
* repeated responses
* incorrect explanations
* student confusion
* teacher usability
* voice reliability
* lesson grounding
* practice quality

---

# 41. PHASE 33 — AI QUALITY EVALUATION

Create a dedicated AI evaluation framework.

Evaluate:

### Grounding

Does the AI use the actual lesson?

### Adaptation

Does it change its response when the student changes?

### Diagnosis

Does it identify the actual misconception?

### Socratic behavior

Does it guide rather than immediately answer?

### Mathematical correctness

Are explanations correct?

### Conversation

Does it maintain context?

### Personalization

Does it use the student's learning evidence?

### Question quality

Are generated questions valid?

### Non-repetition

Does it avoid repeating generic responses?

---

# 42. PHASE 34 — TEACHER CONTENT → AI FULL PIPELINE

Final desired experience:

```text
TEACHER CREATES LESSON
        ↓
ADDS TEXT
        ↓
ADDS PDF
        ↓
ADDS DOCX
        ↓
ADDS VIDEO / APPROVED TRANSCRIPT
        ↓
ADDS QUESTIONS
        ↓
PUBLISH
        ↓
TUKLAS INGESTS CONTENT
        ↓
AI CONTENT INDEX
        ↓
STUDENT OPENS LESSON
        ↓
AI KNOWS CURRENT LESSON
        ↓
STUDENT ASKS QUESTION
        ↓
AI RETRIEVES RELEVANT CONTENT
        ↓
AI ANALYZES STUDENT STATE
        ↓
AI RESPONDS
```

This is the core long-term AI architecture.

---

# 43. PHASE 35 — MULTI-SUBJECT / MULTI-GRADE EXPANSION

Only after the Grade 7 Mathematics architecture is proven.

Potential expansion:

```text
Grade 7 → Grade 8 → Grade 9 → Grade 10

Mathematics
↓
English
↓
Science
↓
Other subjects
```

The architecture must remain curriculum-driven rather than hardcoded around one subject.

---

# 44. PHASE 36 — RESEARCH PLATFORM

Long-term Tuklas may support educational research through anonymized/appropriately governed metrics such as:

* learning progression
* mastery transitions
* mistake patterns
* intervention effectiveness
* practice performance
* AI interaction patterns

Research features must protect student privacy.

---

# 45. FINAL MASTER ARCHITECTURE

```text
                         ┌─────────────────┐
                         │     TEACHER     │
                         └────────┬────────┘
                                  ↓
                         ┌─────────────────┐
                         │ LESSON AUTHORING│
                         └────────┬────────┘
                                  ↓
                    ┌───────────────────────────┐
                    │     PUBLISHED CONTENT    │
                    │                           │
                    │ Lesson                    │
                    │ Skills                    │
                    │ Examples                  │
                    │ Questions                 │
                    │ PDF/DOCX                 │
                    │ Teacher Materials        │
                    │ Approved Resources       │
                    └─────────────┬─────────────┘
                                  ↓
                    ┌───────────────────────────┐
                    │   CONTENT INTELLIGENCE    │
                    │                           │
                    │ Extraction                │
                    │ Normalization             │
                    │ Chunking                  │
                    │ Indexing                  │
                    │ Retrieval                 │
                    └─────────────┬─────────────┘
                                  ↓
                    ┌───────────────────────────┐
                    │   AI LEARNING COMPANION   │
                    │                           │
                    │ Lesson Context            │
                    │ Student Context           │
                    │ Conversation               │
                    │ Mistakes                  │
                    │ Mastery                   │
                    │ Prerequisites             │
                    └─────────────┬─────────────┘
                                  ↓
             ┌────────────────────┼────────────────────┐
             ↓                    ↓                    ↓
        ┌──────────┐        ┌──────────┐        ┌──────────┐
        │ TEXT AI  │        │ VOICE AI │        │ PRACTICE │
        └────┬─────┘        └────┬─────┘        └────┬─────┘
             └────────────────────┼────────────────────┘
                                  ↓
                         ┌─────────────────┐
                         │ MISTAKE ENGINE  │
                         └────────┬────────┘
                                  ↓
                         ┌─────────────────┐
                         │ ADAPTIVE ENGINE │
                         └────────┬────────┘
                                  ↓
                         ┌─────────────────┐
                         │ MASTERY ENGINE  │
                         └────────┬────────┘
                                  ↓
                         ┌─────────────────┐
                         │ NEXT LEARNING   │
                         │ STEP            │
                         └────────┬────────┘
                                  ↓
                              STUDENT
```

---

# 46. NON-NEGOTIABLE DEVELOPMENT RULES

Claude/Antigravity must follow these rules.

## Rule 1 — Inspect before changing

Before implementing anything:

```text
INSPECT
→ SEARCH
→ TRACE
→ TEST
→ IDENTIFY GAP
→ IMPLEMENT
→ VERIFY
```

Do not assume something is missing.

---

## Rule 2 — Do not rebuild working systems

Reuse existing modules when they are correct.

Only replace a subsystem when evidence shows that it is inadequate.

---

## Rule 3 — Every change must map to the master plan

Every implementation should state:

```text
Master Plan Section:
Phase:
Problem:
Current Behavior:
Desired Behavior:
Implementation:
Verification:
```

---

## Rule 4 — Tests do not automatically equal real-world readiness

Separate:

```text
AUTOMATED TEST
REAL BROWSER TEST
REAL DEVICE TEST
REAL USER TEST
```

Do not call a feature 100% complete merely because automated tests pass.

---

## Rule 5 — Never fake verification

If something was not tested:

```text
NOT VERIFIED
```

If something is partially implemented:

```text
PARTIAL
```

If something is missing:

```text
NOT IMPLEMENTED
```

If something works only through a fallback:

```text
FALLBACK VERIFIED
```

Do not label it fully implemented.

---

## Rule 6 — Never claim the AI accessed content it did not receive

Especially:

* PDF
* DOCX
* YouTube
* external websites
* teacher files

---

## Rule 7 — AI must not become a generic chatbot

Every tutoring response should be connected to learning context whenever relevant.

---

## Rule 8 — AI should not repeatedly return the same response

The AI must consider:

```text
CURRENT MESSAGE
+
CONVERSATION HISTORY
+
CURRENT QUESTION
+
PREVIOUS ATTEMPTS
+
MISTAKES
+
MASTERY
+
LESSON
+
TUTORING STATE
```

---

## Rule 9 — Mathematical correctness must be deterministic where possible

Use deterministic validators for:

* answers
* generated questions
* arithmetic
* progression rules
* mastery rules
* access rules

AI should assist the learning process, not become the sole authority.

---

## Rule 10 — Do not add features just because they are possible

Every feature must answer:

> Does this improve the student's learning experience, teacher workflow, reliability, security, or production readiness?

---

# 47. DEFINITION OF "100% READY"

Tuklas should NOT use:

> "100% bug-free."

That is not a realistic engineering claim.

Instead, production readiness means every critical release gate has evidence.

```text
FUNCTIONALITY              VERIFIED
SECURITY                   VERIFIED
DATABASE                   VERIFIED
AUTHENTICATION             VERIFIED
AUTHORIZATION              VERIFIED
STUDENT EXPERIENCE         VERIFIED
TEACHER EXPERIENCE         VERIFIED
AI GROUNDING               VERIFIED
AI ADAPTATION              VERIFIED
MATHEMATICAL CORRECTNESS   VERIFIED
VOICE                      REAL DEVICE VERIFIED
DOCUMENT INTELLIGENCE      VERIFIED
MOBILE                     VERIFIED
ACCESSIBILITY              VERIFIED
PRODUCTION RELIABILITY     VERIFIED
REAL USER PILOT            VERIFIED
```

Only then should Tuklas be considered ready for broad publication.

---

# 48. PHASE REPORT STANDARD

After every phase, produce a report in this format:

```text
TUKLAS AI — PHASE XX VERIFICATION REPORT

PHASE:
OBJECTIVE:

IMPLEMENTED:
1.
2.
3.

VERIFICATION:

Feature                         Status
-----------------------------------------
Feature A                       PASS
Feature B                       PASS
Feature C                       PARTIAL
Feature D                       NOT IMPLEMENTED

AUTOMATED TESTS:
XXX / XXX PASS

TYPECHECK:
PASS / FAIL

BUILD:
PASS / FAIL

DATABASE:
PASS / FAIL

SECURITY:
PASS / FAIL

REAL BROWSER:
PASS / NOT COMPLETED

REAL DEVICE:
PASS / NOT COMPLETED

REAL USER:
PASS / NOT COMPLETED

KNOWN LIMITATIONS:
1.
2.
3.

DEFECTS FOUND:
1.
2.

FIXES:
1.
2.

REMAINING RISKS:
1.
2.

FINAL DECISION:
READY_FOR_NEXT_PHASE
or
READY_WITH_MINOR_FIXES
or
BLOCKED
```

Automated evidence and real-world evidence must remain separate.

---

# 49. CURRENT MASTER STATUS

```text
PHASE 1–17
FOUNDATIONAL PLATFORM
        ↓
VERIFIED / IMPLEMENTED AREAS

PHASE 18
CONTROLLED REAL-USER PILOT FOUNDATION
        ↓
VERIFIED

PHASE 19–20
VOICE TUTOR
        ↓
AUTOMATED VERIFICATION COMPLETE
REAL HARDWARE VALIDATION PENDING

PHASE 21
AI LEARNING INTELLIGENCE
        ↓
325/325 AUTOMATED ASSERTIONS PASS
        ↓
IMPORTANT GAPS REMAIN
        ├── PDF/DOCX extraction
        ├── physical voice testing
        └── Gemini external dependency

PHASE 22
REAL-WORLD END-TO-END VALIDATION
        ↓
NEXT
```

---

# 50. FINAL PRODUCT GOAL

The ultimate goal of Tuklas AI is:

> **A student enters a lesson created by a teacher, learns the concept, interacts with the material, asks questions through text or voice, receives Socratic guidance instead of immediate answers, makes mistakes safely, understands those mistakes, receives targeted practice, adapts to their learning needs, and gradually demonstrates mastery.**

The teacher should be able to:

> **Create and publish the learning environment without manually programming the AI.**

The system should:

```text
TEACHER CONTENT
      ↓
CONTENT INTELLIGENCE
      ↓
AI UNDERSTANDS LESSON
      ↓
STUDENT LEARNS
      ↓
STUDENT RESPONDS
      ↓
SYSTEM COLLECTS EVIDENCE
      ↓
MISTAKE ENGINE
      ↓
ADAPTIVE ENGINE
      ↓
MASTERY ENGINE
      ↓
AI USES UPDATED EVIDENCE
      ↓
NEXT BEST LEARNING INTERVENTION
```

That feedback loop is the heart of Tuklas AI.

---

# 51. INSTRUCTION TO CLAUDE / GOOGLE ANTIGRAVITY

Treat this document as the **MASTER SOURCE OF TRUTH** for Tuklas AI.

Before implementing any new phase:

1. Inspect the existing repository.
2. Compare the current implementation against this master plan.
3. Search for existing implementations before declaring anything missing.
4. Do not rebuild working systems.
5. Identify the smallest real gap.
6. Implement only the current phase scope.
7. Test the actual behavior.
8. Test security and authorization.
9. Test persistence where applicable.
10. Test the browser experience where applicable.
11. Clearly separate automated verification from real-device verification.
12. Generate a complete phase verification report.
13. Do not proceed to the next phase until the current phase has been verified.
14. Never claim 100% implementation without evidence.
15. Never fabricate AI access to lesson resources.
16. Never allow the AI to bypass Socratic educational rules.
17. Never allow student or teacher data to cross authorization boundaries.
18. Preserve all existing passing functionality unless the current phase explicitly requires a change.
19. Every new feature must map to this master plan.
20. The goal is not to maximize features. The goal is to create a **reliable, adaptive, content-grounded learning system that students and teachers can genuinely use.**

## FIRST ACTION

Do NOT immediately write code.

First perform a:

**PHASE 22 READINESS AUDIT**

Compare the actual repository against this master plan.

Produce:

```text
CURRENT IMPLEMENTATION
vs.
MASTER PLAN
```

with:

```text
REAL
PARTIAL
SIMULATED
MISSING
BROKEN
NOT VERIFIED
```

Then identify the highest-priority Phase 22 gaps.

Only after the audit should implementation begin.
